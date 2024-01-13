# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Point of Sale Khmer',
    'version': '1.0',
    'category': 'Sales/Point of Sale',
    'sequence': 6,
    'summary': 'add Cambodia Operation in the Point of Sale ',
    'description': """

This module adds several features to the Point of Sale that are specific to restaurant management:
- Bill Printing: Allows you to print a receipt before the order is paid
- Bill Splitting: Allows you to split an order into different orders
- Kitchen Order Printing: allows you to print orders updates to kitchen or bar printers

""",
    'depends': ['point_of_sale'],
    'installable': True,
    'application': True,
    'data': [
        # 'views/pos_kh_views.xml',
        'views/pos_kh_templates.xml'
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_two_currencies/static/**/*',
            'pos_two_currencies/static/src/xml/pos.xml',
        ],
    },
    'license': 'LGPL-3',
}