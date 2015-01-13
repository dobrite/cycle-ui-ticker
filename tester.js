var Cycle = require('cyclejs');
var h = Cycle.h;
var Rx = Cycle.Rx;

var TickerDataFlowNode = Cycle.createDataFlowNode(function (attributes) {
  var TickerModel = Cycle.createModel(function (attributes, intent) {
    return {
      ticker$: attributes.get('ticker$'),
      out$: attributes.get('ticker$').map(function () { return 1; }),
      highlighted$: Rx.Observable
        .merge(
          intent.get('startHighlight$').map(function () { return true; }),
          intent.get('stopHighlight$').map(function () { return false; })
        )
        .startWith(false)
    };
  });

  var TickerView = Cycle.createView(function (model) {
    return {
      vtree$: model.get('ticker$').combineLatest(
        attributes.get('num$'),
        attributes.get('selected$'),
        model.get('highlighted$'),
        function (ticker, num, selected, highlighted) {
          var color = (highlighted) ? 'red' : 'black';
          var border = (selected) ? '1px solid black' : null;
          return h('div.ticker', [
            h('div', {
              attributes: {
                'data-num': num
              },
              style: {
                color: color,
                border: border
              },
              onmouseenter: 'mouseenter$',
              onmouseleave: 'mouseleave$',
              onclick: 'tickerClick$',
            }, String(ticker))
          ]);
        }
      )
    };
  });

  var TickerIntent = Cycle.createIntent(function (view) {
    return {
      startHighlight$: view.get('mouseenter$'),
      stopHighlight$: view.get('mouseleave$')
    };
  });

  TickerIntent.inject(TickerView);
  TickerView.inject(TickerModel);
  TickerModel.inject(attributes, TickerIntent);

  return {
    vtree$: TickerView.get('vtree$'),
    click$: TickerView.get('tickerClick$'),
    out$: TickerModel.get('out$')
  };
});

var Initial = Cycle.createDataFlowSource({
  initial$: Rx.Observable.just({ selected: 0, total: 0, }),
});

var Model = Cycle.createModel(function (intent, initial) {
  var setSelectedFn$ = intent.get('selectTicker$').map(function (num) {
    return function (state) {
      state.selected = num;
      return state;
    }
  });

  var setTotalFn$ = intent.get('out$').map(function (val) {
    return function (state) {
      state.total += val;
      return state;
    };
  });

  return {
    ticker$: Rx.Observable.interval(1000).startWith(0),
    state$: Rx.Observable
      .merge(setTotalFn$, setSelectedFn$)
      .merge(initial.get('initial$'))
      .scan(function (state, f) {
        return f(state);
      })
  };
});

var View = Cycle.createView(function (model) {
  return {
    vtree$: model.get('ticker$').withLatestFrom(model.get('state$'),
      function (ticker, state) {
        return h('div#the-view', [
          "Total: " + state.total,
          [0, 1, 2, 3, 4].map(function (i) {
            return h('ticker', {
              attributes: {
                ticker: ticker,
                num: i,
                selected: i === parseInt(state.selected, 10),
              },
              onclick: 'tickerClick$',
              onout: 'out$',
            });
          }),
        "Selected: " + state.selected]);
    })
  };
});

var Intent = Cycle.createIntent(function (view) {
  return {
    selectTicker$: view.get('tickerClick$').map(function (e) { return e.target.dataset.num; }),
    out$: view.get('out$'),
  };
});

var renderer = Cycle.createRenderer('.js-container');
renderer.registerCustomElement('ticker', TickerDataFlowNode);
renderer.inject(View);
Intent.inject(View).inject(Model).inject(Intent, Initial);
