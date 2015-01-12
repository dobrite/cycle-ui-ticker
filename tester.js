var Cycle = require('cyclejs');
var h = Cycle.h;
var Rx = Cycle.Rx;

var TickerDataFlowNode = Cycle.createDataFlowNode(function (attributes) {
  var TickerModel = Cycle.createModel(function (attributes, intent) {
    return {
      ticker$: attributes.get('ticker$'),
      out$: attributes.get('ticker$').map(function () { return 1; }),
      // num$ not necessary, I guess, if its purpose was for highlighting
      highlighted$: Rx.Observable // from internal intent, not from attributes
        .merge(
          intent.get('startHighlight$').map(function () { return true; }),
          intent.get('stopHighlight$').map(function () { return false; })
        )
        .startWith(false)
    };
  });

  var TickerView = Cycle.createView(function (model) {
    return {
      // Use combineLatest when you are confident that the combined observables
      // are completely independent to each other. use withLatestFrom when you
      // know one of the observables is derived from the other.
      vtree$: model.get('ticker$').combineLatest(model.get('highlighted$'),
        function (ticker, highlighted) {
          var color = (highlighted) ? 'red' : 'black';
          return h('div.ticker', [
            h('div', {
              style: {color: color}, // style doesn't need to be inside attributes
              onmouseenter: 'mouseenter$',
              onmouseleave: 'mouseleave$',
              // we use these two events to implement hover behavior
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
      // name intent events in such a way that they mean some user intention.
      // Here, we interpret mouse entering as "the user wants to start highlighting", etc.
    };
  });

  TickerIntent.inject(TickerView);
  TickerView.inject(TickerModel);
  TickerModel.inject(attributes, TickerIntent);

  return {
    vtree$: TickerView.get('vtree$'),
    out$: TickerModel.get('out$')
  };
});

var Initial = Cycle.createDataFlowSource({
  initial$: Rx.Observable.just({total: 0}),
});

var Model = Cycle.createModel(function (intent, initial) {
  // I removed highlighting state from here, it wasn't clear why did it have to
  // leak out from the custom element ticker. Maybe you need it for game logic,
  // but I think its natural to assume highlighting logic should be handled
  // internally by the ticker.

  // Since this is an observable emitting functions, rather name it as something
  // like fn$, because total$ suggests it is an observable of numbers
  var setTotalFn$ = intent.get('out$').map(function (val) {
    return function (state) {
      state.total += val;
      return state;
    };
  });

  return {
    ticker$: Rx.Observable.interval(1000).startWith(0),
    state$: Rx.Observable
      .merge(setTotalFn$)
      .merge(initial.get('initial$'))
      .scan(function (state, f) {
        return f(state);
      })
      // publish refCount not needed. I think actually all exported observables
      // from DataFlowNodes are already hot observables because they are all
      // backed by Subjects.
  };
});

var View = Cycle.createView(function (model) {
  return {
    vtree$: model.get('ticker$').withLatestFrom(model.get('state$'), function (ticker, state) {
      return h('div#the-view', ["Total: " + String(state.total),
        [0, 1, 2, 3, 4].map(function (i) {
          return h('ticker', {attributes: {ticker: ticker}, onout: 'out$'});
          // num and highlight not needed anymore here since highlighting is
          // handled internally.
        })
      ]);
    })
  };
});

var Intent = Cycle.createIntent(function (view) {
  return {
    out$: view.get('out$')
  };
});

var renderer = Cycle.createRenderer('.js-container');
renderer.registerCustomElement('ticker', TickerDataFlowNode);
renderer.inject(View);
Intent.inject(View).inject(Model).inject(Intent, Initial);
