var Cycle = require('cyclejs');
var h = Cycle.h;
var Rx = Cycle.Rx;

var TickerDataFlowNode = Cycle.createDataFlowNode(function (attributes) {
  var TickerModel = Cycle.createModel(function (attributes, intent) {
    return {
      ticker$: attributes.get('ticker$'),
      selected$: attributes.get('selected$'),
      num$: attributes.get('num$'),
      //out$: attributes.get('ticker$').map(function () { return 1; }),
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
        model.get('num$'),
        model.get('selected$'),
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
  selected$: Rx.Observable.just(0),
});

var Model = Cycle.createModel(function (intent, initial) {
  var ticker$ = Rx.Observable.interval(1000).startWith(0);

  var things$ = ticker$.map(function (ticker) {
    return [0, 1, 2, 3, 4].map(function (i) {
      return { num: i, content: ticker };
    });
  });

  var sumThingsContent$ = things$.map(function (things) {
    return things.reduce(function (thing1, thing2) {
      return { content: thing1.content + thing2.content };
    }).content;
  });

  return {
    things$: things$,
    selected$: initial.get('selected$').merge(intent.get('selectTicker$')),
    total$: sumThingsContent$
  };
});

var View = Cycle.createView(function (model) {
  return {
    vtree$: Rx.Observable.combineLatest(
      model.get('things$'),
      model.get('selected$'),
      model.get('total$'),
      function (tickers, selected, total) {
        return h('div#the-view', [
          "Total: " + total,
          tickers.map(function (ticker) {
            return h('ticker', {
              attributes: {
                ticker: ticker.content,
                num: ticker.num,
                selected: ticker.num === parseInt(selected, 10),
              },
              onclick: 'tickerClick$'
            });
          }),
        "Selected: " + selected]);
    })
  };
});

var Intent = Cycle.createIntent(function (view) {
  return {
    selectTicker$: view.get('tickerClick$').map(function (e) { return e.target.dataset.num; })
  };
});

var renderer = Cycle.createRenderer('.js-container');
renderer.registerCustomElement('ticker', TickerDataFlowNode);
renderer.inject(View);
Intent.inject(View).inject(Model).inject(Intent, Initial);
