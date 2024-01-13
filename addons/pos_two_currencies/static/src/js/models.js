odoo.define('pos_kh.models', function (require) {
  "use strict";

  var models = require('point_of_sale.models');
  var utils = require('web.utils');
  var round_pr = utils.round_precision;
  const OrderWidget = require('point_of_sale.OrderWidget');
  const OrderDetails = require('point_of_sale.OrderDetails');
  const PaymentScreenStatus = require('point_of_sale.PaymentScreenStatus');
  const PaymentScreen = require('point_of_sale.PaymentScreen');
  const ProductItem = require('point_of_sale.ProductItem');
  const Registries = require('point_of_sale.Registries');

  const PosResPaymentScreen = (PaymentScreen) =>
      class extends PaymentScreen {
          async validateOrder(isForceValidate) {
              if (await this._isOrderValid(isForceValidate)) {
                  // remove pending payments before finalizing the validation
                  for (let line of this.paymentLines) {
                      if (!line.is_done()){
                          this.currentOrder.remove_paymentline(line);
                      }
                  }

                  // Update Payment line status
                  var lines = this.paymentLines;
                  var khr_last = false;
                  if(lines[lines.length-1].name.includes("KHR")){
                      khr_last=true;
                  }

                  // Change Cash KHR payment to USD
                  for (let line of this.paymentLines) {
                      if(line.is_khr()){
                          const currency_khr = this.env.pos.currency_khr ? this.env.pos.currency_khr : this.env.pos.currency;
                          const amount = round_pr(line.amount/currency_khr.rate, 0.0001);
                          const payment_method_usd = this.env.pos.payment_methods.find(o => o.name.includes("USD"));
                          this.currentOrder.remove_paymentline(line);
                          this.currentOrder.add_paymentline(payment_method_usd);
                          this.currentOrder.selected_paymentline.set_amount(amount);
                          this.currentOrder.selected_paymentline.set_khr(line.payment_method,khr_last);
                      }
                  }
                  await this._finalizeValidation();
              }
          }
      };

  const PosResOrderWidget = (OrderWidget) =>
      class extends OrderWidget {
        constructor() {
            super();
            this.state.khr = 0;
            this._updateSummary();
        }
        _updateSummary() {
            const total = this.order ? this.order.get_total_with_tax() : 0;
            const currency_khr = this.env.pos.currency_khr ? this.env.pos.currency_khr : this.env.pos.currency;
            const khr = total ? round_pr(total*currency_khr.rate,currency_khr.rounding) : 0;
            this.state.khr = this.env.pos.format_currency_no_symbol(khr)+' '+currency_khr.symbol;
            super._updateSummary();
        }
  };

  const PosResOrderDetails = (OrderDetails) =>
      class extends OrderDetails {
          get khr() {
              const total = this.order ? this.order.get_total_with_tax() : 0;
              const currency_khr = this.env.pos.currency_khr ? this.env.pos.currency_khr : this.env.pos.currency;
              const khr = total ? round_pr(total*currency_khr.rate,currency_khr.rounding) : 0;
              return this.env.pos.format_currency_no_symbol(khr)+' '+currency_khr.symbol;
          }
  };

  const PosResPaymentScreenStatus = (PaymentScreenStatus) =>
      class extends PaymentScreenStatus {
          get totalDueTextkhr() {
              const total = this.currentOrder.get_total_with_tax() + this.currentOrder.get_rounding_applied();
              const currency_khr = this.env.pos.currency_khr ? this.env.pos.currency_khr : this.env.pos.currency;
              const khr = total ? round_pr(total*currency_khr.rate,currency_khr.rounding) : 0;
              return this.env.pos.format_currency_no_symbol(khr)+' '+currency_khr.symbol;
          }
          get changeTextkhr() {
              var lines = this.currentOrder.get_paymentlines();
              var change = this.currentOrder.get_change();
              const currency_khr = this.env.pos.currency_khr ? this.env.pos.currency_khr : this.env.pos.currency;

              if(lines[lines.length-1].name.includes("USD")){
                  change = change - parseInt(change);
                  this.currentOrder.is_khr=false;
              }
              const khr = change ? round_pr(change*currency_khr.rate,currency_khr.rounding) : 0;
              return this.env.pos.format_currency_no_symbol(khr)+' '+currency_khr.symbol;
          }
          get changeText() {
              var lines = this.currentOrder.get_paymentlines();
              var change = this.currentOrder.get_change();
              if(lines[lines.length-1].name.includes("KHR")){
                  change = 0;
                  this.currentOrder.is_khr=true;
              }
              return this.env.pos.format_currency(parseInt(change));
          }
  };

  var existing_models = models.PosModel.prototype.models;
  var currency_index = _.findIndex(existing_models, function (model) {
      return model.model === "res.currency";
  });
  var currency_model = existing_models[currency_index];

  models.load_models([{
    model:  currency_model.model,
    fields: currency_model.fields,
    ids:    false,
    loaded: function(self, currencies){
        _.each(currencies, function(currency){
            if(currency.name === "USD")
                self.currency = currency;
            if(currency.name === "KHR")
                self.currency_khr = currency;
        });
        if(!self.currency)
            self.currency = currencies[0];
        if (self.currency.rounding > 0 && self.currency.rounding < 1) {
            self.currency.decimals = Math.ceil(Math.log(1.0 / self.currency.rounding) / Math.log(10));
        } else {
            self.currency.decimals = 0;
        }
        self.company_currency = self.currency;
    }
    }]
  );

  var _super_Paymentline = models.Paymentline.prototype;
  models.Paymentline = models.Paymentline.extend({
      initialize: function (attributes,options) {
          _super_Paymentline.initialize.apply(this, arguments);
          this.khr = this.khr || 0;
          this.khr_last = false;
          this.khr_name = this.khr_name || "CASH KHR";
      },
      init_from_JSON: function(json){
          _super_Paymentline.init_from_JSON.apply(this, arguments);
          this.khr = json.khr;
      },
      set_khr: function (payment_method,khr_last) {
          var amount = this.amount;
          const currency_khr = this.pos.currency_khr ? this.pos.currency_khr : this.pos.currency;
          if (payment_method.name.includes("KHR")) {
              amount = round_pr(amount*currency_khr.rate,currency_khr.rounding)
          }
          this.khr = amount;
          this.khr_last = khr_last;
          this.khr_name = payment_method.name;
      },
      get_khr: function () {
          return this.khr;
      },
      get_khr_name: function () {
          return this.khr_name;
      },
      is_khr: function() {
          return this.payment_method.name.includes("KHR");
      },
      export_as_JSON: function(){
      var json = _super_Paymentline.export_as_JSON.apply(this,arguments);
      json.khr = this.khr;
      return json;
      }
  });

  var _super_order = models.Order.prototype;
  models.Order = models.Order.extend({
      initialize: function(attributes,options) {
          _super_order.initialize.apply(this,arguments);
          this.is_khr = this.is_khr || false;
          this.save_to_db();
          },
      init_from_JSON: function(json){
          _super_order.init_from_JSON.apply(this,arguments);
          this.is_khr = json.is_khr;
          },
      export_as_JSON: function(){
          var json = _super_order.export_as_JSON.apply(this,arguments);
          json.is_khr = this.is_khr;
          return json;
          },
      get_total_paid: function() {
          return round_pr(this.paymentlines.reduce((function(sum, paymentLine) {
              var amount = paymentLine.get_amount();
              const currency_khr = paymentLine.pos.currency_khr ? paymentLine.pos.currency_khr : paymentLine.pos.currency;
              if (paymentLine.payment_method.name.includes("KHR")) {
                  amount /= currency_khr.rate;
              }
              return sum + amount;
          }), 0), 0.0001);
      },
      set_is_khr:function (is_khr){
          this.is_khr = is_khr;
          this.trigger('change',this);
      },
      get_due: function(paymentline) {
          if (!paymentline) {
              var due = this.get_total_with_tax() - this.get_total_paid();
          } else {
              var due = this.get_total_with_tax();
              var lines = this.paymentlines.models;
              for (var i = 0; i < lines.length; i++) {
                  if (lines[i] === paymentline) {
                      break;
                  } else {
                      var amount = lines[i].get_amount();
                      const currency_khr = paymentline.pos.currency_khr ? paymentline.pos.currency_khr : paymentline.pos.currency;
                      if (paymentline.payment_method.name.includes("KHR")) {
                          amount /= currency_khr.rate;
                      }
                      due -= amount;
                  }
              }
          }
          return round_pr(due, 0.0001);
      },
      get_change: function(paymentline) {
          if (!paymentline) {
              var change = this.get_total_paid() - this.get_total_with_tax() - this.get_rounding_applied();
          } else {
              var change = -this.get_total_with_tax();
              const currency_khr = paymentline.pos.currency_khr ? paymentline.pos.currency_khr : paymentline.pos.currency;
              var lines  = this.paymentlines.models;
              for (var i = 0; i < lines.length; i++) {
                  var amount = lines[i].get_amount();
                  if (paymentline.payment_method.name.includes("KHR")){
                      amount/=currency_khr.rate;
                  }
                  change +=amount;
                  if (lines[i] === paymentline) {
                      break;
                  }
              }
          }
          return round_pr(Math.max(0,change), 0.0001);
      },
      changeTextkhr: function() {
          var change = this.locked ? this.amount_return : this.get_change();
          const currency_khr = this.pos.currency_khr ? this.pos.currency_khr : this.pos.currency;
          var lines = this.get_paymentlines();
          var is_khr = this.is_khr;
          if(!is_khr)
              if(lines[lines.length-1].khr_last){
                  is_khr=true;
              }
          if(!is_khr){
              change = change - parseInt(change);
          }
          const khr = change ? round_pr(change*currency_khr.rate,currency_khr.rounding) : 0;
          return khr;
      },
      changeText: function() {
          var change = this.locked ? this.amount_return : this.get_change();
          var lines = this.get_paymentlines();
          var is_khr = this.is_khr;
          if(!is_khr)
              if(lines[lines.length-1].khr_last){
                  is_khr=true;
              }
          if(is_khr){
              change = 0;
          }
          return parseInt(change);
      },
      get_total_khr: function() {
          const total = this.get_total_with_tax();
          const currency_khr = this.pos.currency_khr ? this.pos.currency_khr : this.pos.currency;
          const khr = total ? round_pr(total*currency_khr.rate,currency_khr.rounding) : 0;
          return khr;
      },
      add_paymentline: function(payment_method) {
          this.assert_editable();
          var newPaymentline = new models.Paymentline({},{order: this, payment_method:payment_method, pos: this.pos});
          const currency_khr = this.pos.currency_khr ? this.pos.currency_khr : this.pos.currency;
          var due = this.get_due();
          if(payment_method.name.includes("KHR")){
              due*=currency_khr.rate;
          }
          newPaymentline.set_amount(due);
          this.paymentlines.add(newPaymentline);
          this.select_paymentline(newPaymentline);
          return newPaymentline;
      },
  });

  Registries.Component.extend(OrderWidget, PosResOrderWidget);
  Registries.Component.extend(OrderDetails, PosResOrderDetails);
  Registries.Component.extend(PaymentScreenStatus, PosResPaymentScreenStatus);
  Registries.Component.extend(PaymentScreen, PosResPaymentScreen);

  return {
      OrderWidget:OrderWidget,
      OrderDetails:OrderDetails,
      PaymentScreenStatus:PaymentScreenStatus,
      PaymentScreen:PaymentScreen,
  };
});
