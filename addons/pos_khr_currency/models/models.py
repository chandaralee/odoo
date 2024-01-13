# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from datetime import datetime, timedelta
from odoo.osv.expression import AND
import pytz
from odoo.tools import float_is_zero, float_round

class PosConfig(models.Model):
    _inherit = 'pos.config'

class PosPayment(models.Model):
    _inherit = "pos.payment"

    khr = fields.Float(string='Amount KHR', help="Total amount of the payment in KHR.")

    def _export_for_ui(self, payment):
        result = super(PosPayment, self)._export_for_ui(payment)
        result['khr'] = payment.khr
        return result

class PosOrder(models.Model):
    _inherit = 'pos.order'

    is_khr = fields.Boolean("Is Paid In KHR?")

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(PosOrder, self)._order_fields(ui_order)
        order_fields['is_khr'] = ui_order.get('is_khr', False)
        return order_fields

    def _export_for_ui(self, order):
        result = super(PosOrder, self)._export_for_ui(order)
        result['is_khr'] = order.is_khr
        return result

    @api.model
    def _get_fields_for_draft_order(self):
        fields = super(PosOrder, self)._get_fields_for_draft_order()
        fields.extend(['is_khr'])
        return fields

    def _payment_fields(self, order, ui_paymentline):
        result = super(PosOrder, self)._payment_fields(order, ui_paymentline)
        result['khr'] = ui_paymentline.get("khr",0.0)
        return result

class ReportSaleDetails(models.AbstractModel):
    _inherit = 'report.point_of_sale.report_saledetails'

    @api.model
    def get_sale_details(self, date_start=False, date_stop=False, config_ids=False, session_ids=False):
        data = super(ReportSaleDetails, self).get_sale_details(date_start, date_stop, config_ids, session_ids)
        domain = [('state', 'in', ['paid', 'invoiced', 'done'])]

        if (session_ids):
            domain = AND([domain, [('session_id', 'in', session_ids)]])
        else:
            if date_start:
                date_start = fields.Datetime.from_string(date_start)
            else:
                # start by default today 00:00:00
                user_tz = pytz.timezone(self.env.context.get('tz') or self.env.user.tz or 'UTC')
                today = user_tz.localize(fields.Datetime.from_string(fields.Date.context_today(self)))
                date_start = today.astimezone(pytz.timezone('UTC'))

            if date_stop:
                date_stop = fields.Datetime.from_string(date_stop)
                # avoid a date_stop smaller than date_start
                if (date_stop < date_start):
                    date_stop = date_start + timedelta(days=1, seconds=-1)
            else:
                # stop by default today 23:59:59
                date_stop = date_start + timedelta(days=1, seconds=-1)

            domain = AND([domain,
                          [('date_order', '>=', fields.Datetime.to_string(date_start)),
                           ('date_order', '<=', fields.Datetime.to_string(date_stop))]
                          ])

            if config_ids:
                domain = AND([domain, [('config_id', 'in', config_ids)]])

        orders = self.env['pos.order'].search(domain)

        user_currency = self.env.company.currency_id

        # payment_ids = self.env["pos.payment"].search([('pos_order_id', 'in', orders.ids)])
        # payments_khr = {}
        # if payment_ids:
        #     for payment in payment_ids:
        #         if payment.khr:
        #             if "Cash KHR" in payments_khr:
        #                 payments_khr["Cash KHR"]=payments_khr["Cash KHR"]+round(payment.khr, 100)
        #             else:
        #                 payments_khr.update({
        #                     "Cash KHR": round(payment.khr, 100)
        #                 })
        #         else:
        #             if payment.name in payments_khr:
        #                 payments_khr[payment.name]=payments_khr[payment.name]+payment.amount
        #             else:
        #                 payments_khr.update({
        #                     payment.name: payment.amount
        #                 })

        products = data["products"]
        order_data = [{
                'date': order.date_order,
                'name': order.pos_reference,
                'session_name': order.session_id.config_id.name,
                'subtotal': round(order.amount_total-order.amount_tax,user_currency.decimal_places),
                'vat': round(order.amount_tax,user_currency.decimal_places),
                'total': round(order.amount_total,user_currency.decimal_places),
            } for order in orders]

        subtotal = round(sum(order["subtotal"] for order in order_data),user_currency.decimal_places)
        vat = round(sum(order["vat"] for order in order_data),user_currency.decimal_places)
        total = round(sum(order["total"] for order in order_data),user_currency.decimal_places)

        total_discount = round(sum(product["discount"] for product in products),user_currency.decimal_places)
        total_qty = round(sum(product["quantity"] for product in products),user_currency.decimal_places)

        data.update({
            "now": datetime.now().strftime('%d/%m/%Y'),
            # "payments_khr": payments_khr.items(),
            "subtotal": subtotal,
            "vat": vat,
            "total": total,
            "total_wo_tax": round(total-vat,user_currency.decimal_places),
            "total_discount": total_discount,
            "total_qty": total_qty,
            "sessions":[self.env['pos.config'].browse(config_id).name for config_id in config_ids],
            'orders': sorted(order_data, key=lambda l: (l['session_name'],l['date'])),
        })
        return data