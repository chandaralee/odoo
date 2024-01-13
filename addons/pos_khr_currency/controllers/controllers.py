# -*- coding: utf-8 -*-
# from odoo import http


# class PosKhrCurrency(http.Controller):
#     @http.route('/pos_khr_currency/pos_khr_currency', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/pos_khr_currency/pos_khr_currency/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('pos_khr_currency.listing', {
#             'root': '/pos_khr_currency/pos_khr_currency',
#             'objects': http.request.env['pos_khr_currency.pos_khr_currency'].search([]),
#         })

#     @http.route('/pos_khr_currency/pos_khr_currency/objects/<model("pos_khr_currency.pos_khr_currency"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('pos_khr_currency.object', {
#             'object': obj
#         })

