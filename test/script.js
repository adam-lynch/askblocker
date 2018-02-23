const ask = {
  geo(){
    if(!navigator.geolocation){
      console.log("Skipping geolocation request because it's unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(position) {
        console.log('geo', position)
      },
      function(error) {
        console.error('geo error', error)
      },
      { some: 'options' }
    );
  },

  midi(){
    if(!navigator.requestMIDIAccess){
      console.log("Skipping midi request because it's unsupported");
      return;
    }
    // Only triggers a request if sysex is true
    navigator.requestMIDIAccess({ sysex: true })
      .then(function(access) {
        console.log('Got MIDI', access);
      })
      .catch(function(e) {
          console.error('MIDI error', e);
      })
  },

  notificationsCallback(){
    if(!('Notification' in window)){
      console.log("Skipping notifications request because it's unsupported");
      return;
    }
    Notification.requestPermission(function(result) {
      console.log('Got it (callback)', result);
      setTimeout(function() {
        new Notification('test (callback) ' + Math.random())
      }, 300)
    });
  },

  notificationsPromisified(){
    if(!('Notification' in window)){
      console.log("Skipping notifications (promisified) request because it's unsupported");
      return;
    }
    Notification.requestPermission().then(function(result) {
        console.log('Got it (promise)', result);
        setTimeout(function() {
          new Notification('test (promise) ' + Math.random())
        }, 300)
    })
        .catch(function(e) {
            console.error(e);
        });
  },

  persistentStorage(){
    if (!navigator.storage || !navigator.storage.persist){
      console.log("Skipping persistent-storage request because it's unsupported");
      return;
    }
    if (navigator.storage && navigator.storage.persist){
      navigator.storage.persist().then(function(granted) {
        if (granted) {
          console.log('Storage success');
        } else {
          console.log('Storage fail');
        }
      });
    }
  },

  userMediaCallback(){
    if(!navigator.getUserMedia){
      console.log("Skipping getUserMedia (callbacks) request because it's unsupported");
      return;
    }
    navigator.getUserMedia(
      { audio: true, video: true },
      function(localMediaStream) {
        console.log('userMedia (callbacks) success')
      },
      function(e){
        console.error('User media (callbacks) reeeejected!', e);
      }
    );
  },

  userMediaPromisified(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      console.log("Skipping getUserMedia (promisified) request because it's unsupported");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(function(localMediaStream) {
        console.log('userMedia (promise) success')
      })
      .catch(function(e){
        console.error('User media (promise) reeeejected!', e);
      });
  },
}

// To be prove that it still detects interactions even if propagation is stopped
window.onload = function(){
  document.querySelector('button').addEventListener('click', function(e){
    e.stopImmediatePropagation();
    e.stopPropagation();
    console.log('Button clicked');
  });
};

// The timeout gives us a chance to interact with the page first
setTimeout(function(){
  ask.geo();
  ask.midi();
  ask.notificationsCallback();
  ask.notificationsPromisified();
  ask.persistentStorage();
  ask.userMediaCallback();
  ask.userMediaPromisified();
}, 1000);