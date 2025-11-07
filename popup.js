const idArray =
  "z s x d c v g b h n j m comma l dot semicolon slash q two w three e four r t six y seven u i nine o zero p minus leftBrk oct1 oct2 oct3 oct4 sustain save reset velDown velUp".split(
    " "
  );

const keyArray =
  "90 83 88 68 67 86 71 66 72 78 74 77 188 76 190 186 191 81 50 87 51 69 52 82 84 54 89 55 85 73 57 79 48 80 189 219"
    .split(" ")
    .map(Number);

const midiArray =
  "0x18 0x19 0x1A 0x1B 0x1C 0x1D 0x1E 0x1F 0x20 0x21 0x22 0x23 0x24 0x25 0x26 0x27 0x28 0x29 0x2A 0x2B 0x2C 0x2D 0x2E 0x2F 0x30 0x31 0x32 0x33 0x34 0x35 0x36 0x37 0x38 0x39 0x3A 0x3B 0x3C 0x3D 0x3E 0x3F 0x40 0x41 0x42 0x43 0x44 0x45 0x46 0x47 0x48 0x49 0x4A 0x4B 0x4C 0x4D 0x4E 0x4F 0x50 0x51 0x52 0x53 0x54 0x55 0x56 0x57 0x58 0x59 0x5A 0x5B 0x5C 0x5D 0x5E 0x5F"
    .split(" ")
    .map((hex) => parseInt(hex, 16));

const noteArray =
  "C1 Db1 D1 Eb1 E1 F1 Gb1 G1 Ab1 A1 Bb1 B1 C2 Db2 D2 Eb2 E2 F2 Gb2 G2 Ab2 A2 Bb2 B2 C3 Db3 D3 Eb3 E3 F3 Gb3 G3 Ab3 A3 Bb3 B3 C4 Db4 D4 Eb4 E4 F4 Gb4 G4 Ab4 A4 Bb4 B4 C5 Db5 D5 Eb5 E5 F5 Gb5 G5 Ab5 A5 Bb5 B5 C6 Db6 D6 Eb6 E6 F6 Gb6 G6 Ab6 A6 Bb6 B6".split(
    " "
  );

let sessionArray = [];
let monoArray = [];
let audioArray = [];
let volumeArray = [];

let notePressed = false;
let ctx; // AudioContext
let previousTime;
let currentOctave = Number(localStorage.selectedOct) || 2;

let sustainState = false;

let mouseState = 0;

let middleC = document.getElementById("comma");


let currentInstrument = "piano";  // default instrument
let sounds = {};                  // to hold Howl objects


const eventHandler = {
  sendEvent(eventObj) {
    const idIndex = idArray.indexOf(eventObj.id);
    const isNoteKey = idIndex >= 0 && idIndex < 36;

    if (isNoteKey) {
      notesHandler.handleNoteEvent(idIndex, eventObj);
      return;
    }

    const isActiveEvent = [
      "mouseenter",
      "mousedown",
      "keydown",
      "touchstart",
    ].includes(eventObj.type);

    if (isActiveEvent) {
      const controlMap = {
        36: () => pitchHandler.changeOct(0),
        37: () => pitchHandler.changeOct(1),
        38: () => pitchHandler.changeOct(2),
        39: () => pitchHandler.changeOct(3),
        40: () => sustainHandler.toggle(),
        41: () => midiHandler.exportMidi(),
        42: () => location.reload(),
        43: (t) => velocityHandler.velocityChangeHandler({ type: t, val: -10 }),
        44: (t) => velocityHandler.velocityChangeHandler({ type: t, val: 10 }),
      };

      const handler = controlMap[idIndex];
      console.log(idIndex);

      if (handler) handler(eventObj.type);
    }
  },

  catchEvent(event) {
    const eventObj = { type: event.type };
    const isPointerEvent = [
      "mousedown",
      "mouseover",
      "mouseup",
      "touchstart",
      "touchend",
    ].includes(event.type);
    const isNoteKey = idArray.indexOf(event.target.id) < 36;
    const isMouseOverNote =
      event.type === "mouseover" && mouseState && isNoteKey;
    const isMouseOutNote = event.type === "mouseout" && mouseState && isNoteKey;
    const isKeyboardEvent = ["keyup", "keydown"].includes(event.type);

    if (isPointerEvent) {
      eventObj.id = event.target.id;
    } else if (isKeyboardEvent) {
      const index = keyArray.indexOf(event.keyCode);
      eventObj.id = idArray[index];
    }

    if (isMouseOverNote) {
      eventHandler.sendEvent({
        ...eventObj,
        type: "mousedown",
        id: event.target.id,
      });
      return;
    }

    if (isMouseOutNote) {
      eventHandler.sendEvent({
        ...eventObj,
        type: "mouseup",
        id: event.target.id,
      });
      return;
    }

    eventHandler.sendEvent(eventObj);
  },

  setListeners() {
    const events = [
      "mouseup",
      "mousedown",
      "keyup",
      "keydown",
      "touchstart",
      "touchend",
      "mouseout",
      "mouseover",
    ];

    events.forEach((evt) =>
      document.body.addEventListener(evt, eventHandler.catchEvent)
    );

    // Arrow key and modifier bindings
    Mousetrap.bind("right", () => {
      if (currentOctave < 3) pitchHandler.changeOct(currentOctave + 1);
    });

    Mousetrap.bind("left", () => {
      if (currentOctave > 0) pitchHandler.changeOct(currentOctave - 1);
    });

    Mousetrap.bind("up", () => {
      velocityHandler.velocityChangeHandler({ type: "mousedown", val: 10 });
    });

    Mousetrap.bind("down", () => {
      velocityHandler.velocityChangeHandler({ type: "mousedown", val: -10 });
    });

    Mousetrap.bind("shift", () => {
      sustainHandler.toggle();
    });
  },
};

const notesHandler = {
  recordEvent(noteObj) {
    // Default duration for key-off events
    const isKeyOff = noteObj.velocity === 0;
    const isMissingDelta = noteObj.delta === 0;
    if (isKeyOff && isMissingDelta) {
      noteObj.delta = 8;
    }

    sessionArray.push(noteObj);
  },

  setKeyActiveVisual(id, isActive) {
    const noteEl = document.getElementById(id);
    if (!noteEl) return;

    isActive
      ? noteEl.classList.add("active")
      : noteEl.classList.remove("active");
  },

  playNoteAudio(midiNote, velocity, index) {
    const noteName = noteArray[midiArray.indexOf(midiNote)];
    const isNoteOn = Number(velocity) !== 0;

    velocityHandler.setVol(noteName);

    function playNote() {
      monoArray[index] = new Howl({
        src: [`/static/audio/${currentInstrument}/${noteName}.mp3`],        volume: volumeArray[noteName],
      });
      monoArray[index].play();
    }

    function fadeNote() {
      if (!sustainState) {
        monoArray[index]?.fade(volumeArray[noteName], 0, 200);
      }
    }

    isNoteOn ? playNote() : fadeNote();
  },

  createNoteData(event) {
    const isSessionEmpty = sessionArray.length === 0;
    function unlockControls() {
      document.getElementById("save").style.opacity = "1";
      document.getElementById("saveFa").style.color = "";
    }

    if (isSessionEmpty) {
      ctx = new AudioContext();
      previousTime = ctx.currentTime;
      unlockControls();
    }

    const pitch = pitchHandler.getPitch(event.id);
    const velocity = velocityHandler.getVel(event.type);
    const delta = Math.floor(
      (ctx.currentTime - (previousTime || 0)) / 0.00390625
    );
    previousTime = ctx.currentTime;

    return { pitch, velocity, delta, type: 9, channel: 0 };
  },

  handleNoteEvent(index, eventObj) {
    const noteObj = notesHandler.createNoteData(eventObj);
    const isNoteOn = noteObj.velocity !== 0;
    const isNewNote = !audioArray[index];

    if (isNoteOn && isNewNote) {
      notePressed = audioArray[index] = true;
      this.playNoteAudio(noteObj.pitch, noteObj.velocity, index);
      this.setKeyActiveVisual(eventObj.id, true);
      this.recordEvent(noteObj);
    } else if (!isNoteOn) {
      notePressed = audioArray[index] = false;
      this.playNoteAudio(noteObj.pitch, 0, index);
      this.setKeyActiveVisual(eventObj.id, false);
      this.recordEvent(noteObj);
    }
  },
};

const pitchHandler = {
  getPitch(id) {
    const index = idArray.indexOf(id);
    if (index === -1) return null;

    const octaveOffset = currentOctave * 12;
    const midiIndex = index + octaveOffset;
    return midiArray[midiIndex];
  },

  changeOct(oct) {
    const octaveButtons = document.getElementById("octaveDiv").children;

    if (middleC) middleC.classList.remove("middleC");

    const middleCMap = {
      0: null,
      1: "t",
      2: "comma",
      3: "z",
    };

    const id = middleCMap[oct];

    if (id) {
      const newMiddleC = document.getElementById(id);
      if (newMiddleC) {
        newMiddleC.classList.add("middleC");
        middleC = newMiddleC;
      }
    } else {
      middleC = null; // clear reference if not set
    }

    if (!notePressed) {
      Array.from(octaveButtons).forEach((btn, i) => {
        btn.className = i === oct ? "selected oct" : "oct";
      });
      currentOctave = oct;
    }
  },

  resolveDOMKey(index) {
    // Given a MIDI index (0–127), return corresponding key ID
    if (index < 36) return idArray[index];
    if (index < 48) return idArray[index - 12];
    if (index < 60) return idArray[index - 24];
    if (index < 72) return idArray[index - 36];
    return null;
  },
};

const velocityHandler = {
  getCurrentVelocity() {
    const val = parseInt(
      document.getElementById("velocityValue")?.innerText || "100",
      10
    );
    return Math.max(0, Math.min(127, val));
  },

  setVol(noteName) {
    const velocity = velocityHandler.getCurrentVelocity();
    const thresholds = [20, 40, 60, 80, 100, 120];
    const volumes = [0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 1.0];

    let volume = volumes[volumes.length - 1];
    for (let i = 0; i < thresholds.length; i++) {
      if (velocity <= thresholds[i]) {
        volume = volumes[i];
        break;
      }
    }

    volumeArray[noteName] = volume;
  },

  velocityChangeHandler({ val }) {
    const current = velocityHandler.getCurrentVelocity();

    let step = 10;
    if (current === 127 && val < 0) step = 7; // 127 → 120
    if (current === 120 && val > 0) step = 7; // 120 → 127

    const newVal = val < 0 ? current - step : current + step;
    velocityHandler.changeVel(newVal);
  },

  changeVel(newVal) {
    const display = document.getElementById("velocityValue");
    if (!display) return;

    const clamped = Math.max(1, Math.min(127, newVal));
    display.innerText = clamped;
    localStorage.velocity = clamped;
  },

  getVel(eventType) {
    return ["mouseenter", "mousedown", "keydown", "touchstart"].includes(
      eventType
    )
      ? velocityHandler.getCurrentVelocity()
      : 0;
  },
};

const sustainHandler = {
  toggle() {
    const btn = document.getElementById("sustain");
    sustainState = !sustainState;

    btn.classList.toggle("on", sustainState);
    localStorage.sustain = sustainState;
  },
};

const midiHandler = {
  init() {
    // Exit if browser doesn't support Web MIDI API
    if (!navigator.requestMIDIAccess) return;

    navigator
      .requestMIDIAccess()
      .then(midiHandler.onMIDISuccess, midiHandler.onMIDIFailure);
  },

  onMIDISuccess(access) {
    const selector = document.getElementById("midiDevices");
    const midiDiv = document.getElementById("midiDiv");
    const inputs = Array.from(access.inputs.values());

    selector.innerHTML = ""; // Clear existing options

    inputs.forEach((input, i) => {
      const option = document.createElement("option");
      option.value = input.id;
      option.textContent = input.name;
      selector.appendChild(option);

      if (input.id === localStorage.midiPort) {
        selector.selectedIndex = i;
        localStorage.midiPortName = input.name;
        input.onmidimessage = midiHandler.handleMIDIMessage;
      }
    });

    midiDiv.style.display = inputs.length ? "flex" : "none";

    selector.addEventListener("change", () => {
      const selected = selector.selectedOptions[0];
      const device = inputs.find((i) => i.id === selected.value);
      localStorage.midiPort = selected.value;
      localStorage.midiPortName = selected.text;
      if (device) device.onmidimessage = midiHandler.handleMIDIMessage;
    });

    access.onstatechange = () => midiHandler.init();
  },

  onMIDIFailure(err) {
    console.error("MIDI init failed:", err);
  },

  handleMIDIMessage(msg) {
    const [status, note, velocity] = msg.data;
    const isNote =
      (status === 144 || status === 128) && note >= 24 && note <= 95;
    if (!isNote) return;

    const pitchHex = "0x" + note.toString(16).toUpperCase();
    const index = midiArray.indexOf(parseInt(pitchHex, 16));
    if (index === -1) return;

    const noteName = noteArray[index];
    if (!ctx) ctx = new AudioContext();
    ctx.resume(); // ensures it's running

    const isNoteOn = status === 144;
    const noteObj = {
      pitch: pitchHex,
      velocity: isNoteOn ? velocity : 0,
      delta: Math.floor((ctx.currentTime - (previousTime || 0)) / 0.00390625),
      channel: 0,
      type: 9,
    };

    previousTime = ctx.currentTime;

    const isSessionEmpty = sessionArray.length === 0;
    if (isSessionEmpty) {
      document.getElementById("save").style.opacity = "1";
      document.getElementById("saveFa").style.color = "";
    }

    if (noteObj.velocity !== 0) {
      audioArray[index] = new Howl({
        src: [`/static/audio/${currentInstrument}/${noteName}.mp3`],        volume: noteObj.velocity / 100,
      });
      audioArray[index].play();
    } else if (!sustainState) {
      audioArray[index]?.fade(audioArray[index]._volume, 0, 200);
    }

    const id = pitchHandler.resolveDOMKey(index);
    if (id) notesHandler.setKeyActiveVisual(id, true);

    sessionArray.push(noteObj);
  },

  exportMidi() {
    if (sessionArray.length < 2) return;

    const events = sessionArray.flatMap((note) => MidiEvent.createNote(note));
    const track = new MidiTrack({ events });
    MidiWriter({ tracks: [track] }).save();
  },
};

const recordHandler = {
  streamRecorder: null,

  init() {
    this.setupStreamRecorder();
  },

  setupStreamRecorder() {
    const streamBtn = document.getElementById("recStreamBtn");
    if (!streamBtn) return;

    const stopRecording = () => {
      streamBtn.classList.remove("on");
      recordHandler.streamRecorder?.finishRecording();
    };

    const startRecording = () => {
      const audioCtx = new AudioContext();
      const dest = Howler.ctx.createMediaStreamDestination();
      Howler.masterGain.connect(dest);

      const source = audioCtx.createMediaStreamSource(dest.stream);

      const recorder = new WebAudioRecorder(source, {
        workerDir: "../static/js/",
      });

      recorder.setEncoding("wav");
      recorder.onComplete = (recorder, blob) => {
        recordHandler.saveBlob(blob);
      };
      recorder.startRecording();

      recordHandler.streamRecorder = recorder;
      streamBtn.classList.add("on");
    };

    streamBtn.addEventListener("click", () => {
      const isRecording = streamBtn.classList.contains("on");
      isRecording ? stopRecording() : startRecording();
    });
  },

  saveBlob(blob) {
    if (!(blob instanceof Blob)) {
      console.error("Invalid blob:", blob);
      return;
    }

    const downloadURL = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadURL;
    downloadLink.download = `KBD2MIDI_PIANO_${new Date().toISOString()}.wav`;
    downloadLink.click();
    URL.revokeObjectURL(downloadURL);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const loadingBar = document.getElementById("loadingBar");
  const loadingContainer = document.getElementById("loadingCont");
  const loadingText = document.getElementById("loading");
  const pianoUI = document.getElementById("pianoWrapper");

  let loadedCount = 0;

  // Track mouse state globally
  document.body.onmousedown = () => (mouseState = 1);
  document.body.onmouseup = () => (mouseState = 0);
  document.querySelector("html").addEventListener("mouseleave", () => {
    mouseState = 0;
  });

  // Ensure white keys are stacked in correct order
  document.querySelectorAll(".white").forEach((key, i, allKeys) => {
    key.style.zIndex = allKeys.length - i;
  });

  // Store window size and selected octave before exit
  window.onbeforeunload = () => {
    localStorage.width = window.outerWidth;
    localStorage.height = window.outerHeight;
    localStorage.selectedOct = currentOctave;
  };

  const initApp = () => {
    fetch("/manifest")
      .then(r => r.json())
      .then(data => {
        document.getElementById("version").innerText = data.version || "1.0";
      })
      .catch(err => {
        console.error("Manifest fetch failed:", err);
        document.getElementById("version").innerText = "dev";
      });


    pitchHandler.changeOct(Number(localStorage.selectedOct || 2));

    if (localStorage.sustain === "true") sustainHandler.toggle();
    if (localStorage.velocity) {
      document.getElementById("velocityValue").innerText =
        localStorage.velocity;
    }

    midiHandler.init();
    recordHandler.init();
    eventHandler.setListeners();
  };

  const preloadAudio = () => {
    noteArray.forEach((noteName) => {
      new Howl({
        src: [`/static/audio/${currentInstrument}/${noteName}.mp3`],
        html5: false,
        volume: 0,
        onload() {
          this.play();
          loadedCount++;
          loadingText.innerText = `Loading ${loadedCount}/72`;
          loadingBar.style.backgroundSize = `${Math.ceil(
            (100 * loadedCount) / noteArray.length
          )}% 100%`;

          if (loadedCount === noteArray.length) {
            loadingContainer.style.display = "none";
            pianoUI.style.display = "flex";
          }
        },
      });
    });
  };

  initApp();
  preloadAudio();
});


// Instrument dropdown listener
document.getElementById("instrumentSelect").addEventListener("change", function() {
    currentInstrument = this.value;
    preloadAudio();
});
