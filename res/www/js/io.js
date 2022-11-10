$(document).ready(function() {
      // Delay socket connection to when the DOM is safe to manipulate
      // Otherwise, we can have issues where fast-building topics are
      // delivered before the DOM is ready to receive them
      // This results in them getting "lost" and never being displayed.
      const socket = io();

      const briefingStylesheet = new CSSStyleSheet();
      document.adoptedStyleSheets.push(briefingStylesheet)

      const EVT_BRIEFING_START = 'briefingstart';
      const EVT_BRIEFING_TOPIC = 'briefingtopic';
      const EVT_BRIEFING_FINISH = 'briefingfinish';
      const EVT_BATTLE_START = 'battlestart';
      const EVT_BATTLE_END = 'battleend';

      socket.on(EVT_BRIEFING_START, async function({ html, css }) {
           console.log(EVT_BRIEFING_START);
           document.adoptedStyleSheets = [ briefingStylesheet ];
           await briefingStylesheet.replace(css);
           $('#briefing').html(html);
      });

      socket.on(EVT_BRIEFING_TOPIC, async function(index, { html, css }) {
            console.log(EVT_BRIEFING_TOPIC, index);
            const stylesheet = new CSSStyleSheet();
            await stylesheet.replace(css);
            document.adoptedStyleSheets.push(stylesheet);

            const topic = $(`#topic-${index}`)
            const transitions = new Set();
            topic.on('transitionstart', function(event) {
                  console.log(`Added transition ${event.originalEvent.propertyName} for topic ${index}. Now size ${transitions.size}`)
                  transitions.add(event.originalEvent.propertyName);
            });
            // Helper function that creates a promise which resolves when the transition effect is done.
            // This allows for a cleaner code style, avoiding deeply nested event handlers ('callback hell')
            const transition = el => new Promise(resolve => {
                  // We will just resolve on transitioncancel, because otherwise a cancelled transition would prevent the topic from being shown. 
                  // Clearly it's better to display it, even if the fancy effect is missing.
                  function resolveWhenAllDone(event) {
                        transitions.delete(event.originalEvent.propertyName);
                        console.log(`Added transition ${event.originalEvent.propertyName} for topic ${index}. Now size ${transitions.size}`)
                        if (transitions.size === 0)
                              resolve();
                  }
                  el.on('transitionend', resolveWhenAllDone).on('transitioncancel', resolveWhenAllDone)
            });
            

            topic.addClass('loaded');
            await transition(topic);
            topic.html(html).removeClass('loading');
            await transition(topic);
            topic.removeClass('loaded');
      });

      socket.on(EVT_BRIEFING_FINISH, function() {
            console.log(EVT_BRIEFING_FINISH);
      });

      socket.on(EVT_BATTLE_START, function() { 
            console.log(EVT_BATTLE_START);
      });

      socket.on(EVT_BATTLE_END, function() {
            console.log(EVT_BATTLE_END)
      });
});