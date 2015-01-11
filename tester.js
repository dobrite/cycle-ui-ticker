var Cycle = require('cyclejs');
var h = Cycle.h;
var Rx = Cycle.Rx;

var TickerDataFlowNode = Cycle.createDataFlowNode(function (attributes) {
  var TickerModel = Cycle.createModel(function (attributes, intent) {
    return {
      ticker$: attributes.get('ticker$'),
      out$: attributes.get('ticker$').map(function () {
        return 1;
      }),
      num$: attributes.get('num$'),
      highlighted$: attributes.get('highlight$'),
    };
  });

  var TickerView = Cycle.createView(function (model) {
    return {
      vtree$: model.get('ticker$').withLatestFrom(model.get('num$'), model.get('highlighted$'),
        function (ticker, num, highlighted) {
          var color = (highlighted) ? 'red' : 'black';
          return h('div.ticker', [
            h('div', {
              attributes: {
                'data-num': num,
                style: "color: " + color + ";",
              },
              onmouseover: 'mouseover$',
            }, String(ticker))
          ]);
        }
      )
    };
  });

  var TickerIntent = Cycle.createIntent(function (view) {
    return {
      highlight$: view.get('mouseover$').map(function (e) {
        return e.target.dataset.num;
      })
    };
  });

  TickerIntent.inject(TickerView);
  TickerView.inject(TickerModel);
  TickerModel.inject(attributes, TickerIntent);

  return {
    vtree$: TickerView.get('vtree$'),
    highlight$: TickerIntent.get('highlight$'),
    out$: TickerModel.get('out$'),
  };
});

var Initial = Cycle.createDataFlowSource({
  initial$: Rx.Observable.just({
    highlight: 0,
    total: 0,
  }),
});

var Model = Cycle.createModel(function (intent, initial) {
  var highlight$ = intent.get('highlight$').map(function (i) {
    return function (state) {
      state.highlight = i;
      return state;
    }
  });

  var total$ = intent.get('out$').map(function (val) {
    return function (state) {
      state.total += val;
      return state;
    };
  });

  return {
    ticker$: Rx.Observable.interval(1000).startWith(0),
    state$: Rx.Observable
      .merge(total$, highlight$)
      .merge(initial.get('initial$'))
      .scan(function (state, f) {
        return f(state);
      })
      .publish()
      .refCount()
  };
});

var View = Cycle.createView(function (model) {
  return {
    // model.get('ticker$').withLatestFrom(model.get('state$'), function (ticker, state) {
    vtree$: model.get('ticker$').withLatestFrom(model.get('state$'), function (ticker, state) {
      return h('div#the-view', ["Total: " + String(state.total),
        [0, 1, 2, 3, 4].map(function (i) {
          return h('ticker', {
            attributes: {
              ticker: ticker,
              num: i,
              highlight: i === parseInt(state.highlight, 10),
            },
            onhighlight: 'highlight$',
            onout: 'out$',
          });
        })
      ]);
    })
  };
});

var Intent = Cycle.createIntent(function (view) {
  return {
    highlight$: view.get('highlight$'),
    out$: view.get('out$'),
  };
});

var renderer = Cycle.createRenderer('.js-container');
renderer.registerCustomElement('ticker', TickerDataFlowNode);
renderer.inject(View);
Intent.inject(View).inject(Model).inject(Intent, Initial);
