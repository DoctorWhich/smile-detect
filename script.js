const video = document.getElementById('video');
const alertSound = document.getElementById('alertSound');
let smileHistory = []; // Array to track smile detection over time
let smileThreshold = 0.5; // Threshold for detecting a smile
let checkInterval = 100; // Check every 100 ms (0.1 second)
let durationToCheck = 10; // Number of seconds to check
let nonSmilingThreshold = 0.7; // Trigger sound if no smile is detected for at least 7 checks

document.getElementById('threshold').value = "" + (smileThreshold * 100);
document.getElementById('period').value = "" + (durationToCheck);
document.getElementById('frequency').value = "" + (1000 / checkInterval).toFixed(2);
document.getElementById('time_threshold').value = "" + (nonSmilingThreshold * 100);

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
  faceapi.nets.faceExpressionNet.loadFromUri('./models')
]).then(startVideo);

function startVideo() {
  navigator.getUserMedia(
    { video: {} },
    stream => video.srcObject = stream,
    err => console.error(err)
  );
}

let intervalID;

video.addEventListener('play', () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.prepend(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  function updateInterval() {
    if (intervalID) clearInterval(intervalID);

    intervalID = setInterval(async () => {
      const paused = document.getElementById('pause').checked;

      // Update parameters
      smileThreshold = document.getElementById('threshold').value / 100;
      nonSmilingThreshold = document.getElementById('time_threshold').value / 100;
      durationToCheck = parseInt(document.getElementById('period').value, 10);
      const frequency = parseFloat(document.getElementById('frequency').value);
      checkInterval = 1000 / frequency;

      console.log(smileThreshold, durationToCheck, checkInterval);

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      if (detections.length > 0) {
        const smileProbability = detections[0].expressions.happy;
        const isSmiling = smileProbability >= smileThreshold;

        // Record whether a smile was detected (1 for smile, 0 for no smile)
        smileHistory.push(isSmiling ? 1 : 0);

        // Determine how many checks fit into the durationToCheck
        const maxHistoryLength = Math.ceil(durationToCheck * (1000 / checkInterval));

        // Keep only the last `maxHistoryLength` entries in the smile history
        if (smileHistory.length > maxHistoryLength) {
          smileHistory.shift();
        }

        // Count how many times no smile was detected in the last `durationToCheck` seconds
        const nonSmilingCount = smileHistory.reduce((acc, curr) => acc + (curr === 0 ? 1 : 0), 0);

        if (!paused) {
          const readout = document.getElementById('readout');
          readout.textContent = nonSmilingCount + " non-smile checks --- " + (smileProbability.toFixed(2) * 100) + "%";

          // Update color based on smile probability
          if (smileProbability < smileThreshold) {
            readout.style.color = "red";
          } else if (smileProbability < (1 - smileThreshold) / 2 + smileThreshold) {
            readout.style.color = "orange";
          } else {
            readout.style.color = "green";
          }
        }

        // Play or pause alert sound based on smile detection
        if (!paused && nonSmilingCount >= (durationToCheck * 1000 / checkInterval) * nonSmilingThreshold) {
          if (alertSound.paused) {
            alertSound.play();
          }
        } else {
          alertSound.pause();
          alertSound.currentTime = 0;  // Reset sound to start
        }
      } else {
        // If no face is detected, pause the sound
        alertSound.pause();
        alertSound.currentTime = 0;
      }

      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
    }, checkInterval);
  }

  updateInterval();

  // Listen for changes to parameters and update interval accordingly
  document.getElementById('threshold').addEventListener('change', updateInterval);
  document.getElementById('period').addEventListener('change', updateInterval);
  document.getElementById('frequency').addEventListener('change', updateInterval);
  document.getElementById('time_threshold').addEventListener('change', updateInterval);
});
