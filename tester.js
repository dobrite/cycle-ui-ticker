var Cycle = require('cyclejs');
var h = Cycle.h;
var Rx = Cycle.Rx;

var ThingDataFlowNode = Cycle.createDataFlowNode(function (attributes) {
  var ThingModel = Cycle.createModel(function (attributes, intent) {
    return {
      content$: attributes.get('content$'),
      num$: attributes.get('num$'),
      selected$: attributes.get('selected$'),
      highlighted$: Rx.Observable
        .merge(
          intent.get('startHighlight$').map(function () { return true; }),
          intent.get('stopHighlight$').map(function () { return false; })
        )
        .startWith(false)
    };
  });

  var ThingView = Cycle.createView(function (model) {
    return {
      vtree$: model.get('content$').combineLatest(
        model.get('num$'),
        model.get('selected$'),
        model.get('highlighted$'),
        function (content, num, selected, highlighted) {
          var color = (highlighted) ? 'red' : 'black';
          var border = (selected) ? '1px solid black' : null;
          return h('div.thing', [
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
              onclick: 'thingClick$',
            }, String(content))
          ]);
        }
      )
    };
  });

  var ThingIntent = Cycle.createIntent(function (view) {
    return {
      startHighlight$: view.get('mouseenter$'),
      stopHighlight$: view.get('mouseleave$')
    };
  });

  ThingIntent.inject(ThingView);
  ThingView.inject(ThingModel);
  ThingModel.inject(attributes, ThingIntent);

  return {
    vtree$: ThingView.get('vtree$'),
    click$: ThingView.get('thingClick$')
  };
});

var Initial = Cycle.createDataFlowSource({
  selected$: Rx.Observable.just(0)
});

var Model = Cycle.createModel(function (intent, initial) {
  var ticker$ = Rx.Observable.interval(1000).startWith(0);

  var things$ = ticker$.map(function (ticker) {
    return [0, 1, 2, 3, 4].map(function (i) {
      return {num: i, content: ticker};
    });
  });

  var sumThingsContent$ = things$.map(function (things) {
    return things.reduce(function (thing1, thing2) {
      return {content: thing1.content + thing2.content};
    }).content;
  });

  return {
    things$: things$,
    selected$: initial.get('selected$')
      .merge(intent.get('selectThing$')),
    total$: sumThingsContent$
  };
});

var View = Cycle.createView(function (model) {
  return {
    vtree$: Rx.Observable.combineLatest(
      model.get('things$'),
      model.get('selected$'),
      model.get('total$'),
      function (things, selected, total) {
        return h('div#the-view', [
          "Total: " + total,
          things.map(function (thing) {
            return h('thing', {
              attributes: {
                content: thing.content,
                num: thing.num,
                selected: thing.num === parseInt(selected, 10),
              },
              onclick: 'thingClick$'
            });
          }),
        "Selected: " + selected]);
    })
  };
});

var Intent = Cycle.createIntent(function (view) {
  return {
    selectThing$: view.get('thingClick$').map(function (e) { return e.target.dataset.num; })
  };
});

var renderer = Cycle.createRenderer('.js-container');
renderer.registerCustomElement('thing', ThingDataFlowNode);
renderer.inject(View);
Intent.inject(View).inject(Model).inject(Intent, Initial);
