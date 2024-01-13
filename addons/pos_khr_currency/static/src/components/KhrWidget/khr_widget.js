/** @odoo-module */
import { OrderWidget } from "@point_of_sale/app/generic_components/order_widget/order_widget";

import { roundPrecision as round_pr } from "@web/core/utils/numbers";

export class KhrWidget extends OrderWidget {
   constructor() {
      super();
      this.state.totalKhr = 0;
      this._updateSummary();
  }
  _updateSummary() {
      const total = this.order ? this.order.get_total_with_tax() : 0;
      const currency_khr = this.env.pos.currency_khr ? this.env.pos.currency_khr : this.env.pos.currency;
      const khr = total ? round_pr(total*currency_khr.rate,currency_khr.rounding) : 0;
      this.state.totalKhr = this.env.pos.format_currency_no_symbol(khr)+' '+currency_khr.symbol;
      super._updateSummary();
  }
}
