const socket = io();

const briefingStylesheet = new CSSStyleSheet();
document.adoptedStyleSheets.push(briefingStylesheet);

const EVT_BRIEFING_START = 'briefingstart';
const EVT_BRIEFING_TOPIC = 'briefingtopic';
const EVT_BRIEFING_FINISH = 'briefingfinish';
const EVT_BATTLE_START = 'battlestart';
const EVT_BATTLE_END = 'battleend';

socket.on(EVT_BRIEFING_START, function({ html, css }) {
     console.log('start');
     $('#briefing').html(html); 
});

socket.on(EVT_BRIEFING_TOPIC, async function(index, { html, css }) {
      console.log('topic', index);
      const stylesheet = new CSSStyleSheet();
      await stylesheet.replace(css);
      document.adoptedStyleSheets.push(stylesheet);
      $(`#topic-${index}`).html(html);
});

socket.on('briefingfinish', function() {
      console.log('finish');
});
// socket.on('battlestart', function(briefing) { 
//       $('#briefing').replaceWith(briefing.html); 
//       briefingStylesheet.replace(briefing.css);
// });
// 

socket.emit('ready');