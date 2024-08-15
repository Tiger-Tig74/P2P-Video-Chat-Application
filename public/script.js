document.addEventListener('DOMContentLoaded', function () {
    const socket = io(); // Connect to Socket.IO server

    const roomForm = document.getElementById('joinForm');
    const roomNameInput = document.getElementById('roomNameInput');
    const joinButton = document.getElementById('joinButton');
    const videoContainer = document.getElementById('videoContainer');
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const statusMessage = document.getElementById('statusMessage');

    let localStream;
    let remoteStream;
    let rtcPeerConnection;
    let isRoomCreator;

    // Function to handle errors
    function handleError(error) {
        console.error('Error: ', error);
        statusMessage.innerText = 'Error: ' + error.message;
    }

    rtcPeerConnection.onerror = function (event) {
        console.error('RTC Peer Connection Error:', event.error);
    };

    socket.on('error', function (error) {
        console.error('Socket.IO Error:', error);
    });

    // Function to handle room joining/creation
    function joinRoom(roomName) {
        socket.emit('createOrJoin', roomName);
    }

    // Function to start local video
    function startLocalVideo() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('getUserMedia is not supported');
        }

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(function (stream) {
                localStream = stream;
                localVideo.srcObject = stream;
                console.log('Local stream obtained:', localStream);
            })
            .catch(function (error) {
                console.error('Error accessing media devices:', error);
                if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    // Handle no media devices available
                    statusMessage.innerText = 'No webcam or microphone found. Please connect a webcam and microphone to use this application.';
                } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    // Handle permission denied
                    statusMessage.innerText = 'Access to webcam and microphone is denied. Please grant permission to use this application.';
                } else {
                    // Handle other errors
                    statusMessage.innerText = 'Error accessing media devices: ' + error.message;
                }
            });

    }

    // Function to create and configure peer connection
    function createPeerConnection() {
        rtcPeerConnection = new RTCPeerConnection(null);

        rtcPeerConnection.onicecandidate = function (event) {
            if (event.candidate) {
                console.log('Local ICE candidate:', event.candidate);
                socket.emit('candidate', event.candidate);
            }
        };

        rtcPeerConnection.ontrack = function (event) {
            console.log('Remote track added:', event.track);
            if (event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                remoteStream = event.streams[0];
                console.log('Remote stream received:', remoteStream);
            }
        };

        if (localStream) {
            localStream.getTracks().forEach(track => {
                rtcPeerConnection.addTrack(track, localStream);
            });
        }
    }

    // Socket.IO event handlers
    socket.on('created', function (roomName) {
        isRoomCreator = true;
        statusMessage.innerText = 'Room created: ' + roomName;
        startLocalVideo();
    });

    socket.on('joined', function (roomName) {
        isRoomCreator = false;
        statusMessage.innerText = 'Joined room: ' + roomName;
        startLocalVideo();
        createPeerConnection();
    });

    socket.on('full', function (roomName) {
        statusMessage.innerText = 'Room ' + roomName + ' is full';
    });

    socket.on('offer', function (offer) {
        if (!isRoomCreator) {
            console.log('Received offer:', offer);
            createPeerConnection();
            rtcPeerConnection.setRemoteDescription(offer)
                .then(function () {
                    return rtcPeerConnection.createAnswer();
                })
                .then(function (answer) {
                    return rtcPeerConnection.setLocalDescription(answer);
                })
                .then(function () {
                    socket.emit('answer', rtcPeerConnection.localDescription);
                })
                .catch(handleError);
        }
    });

    socket.on('answer', function (answer) {
        console.log('Received answer:', answer);
        rtcPeerConnection.setRemoteDescription(answer)
            .catch(handleError);
    });

    socket.on('candidate', function (candidate) {
        console.log('Received ICE candidate:', candidate);
        rtcPeerConnection.addIceCandidate(candidate)
            .catch(handleError);
    });

    // Event listener for join button click
    joinButton.addEventListener('click', function (event) {
        event.preventDefault();
        const roomName = roomNameInput.value.trim();

        if (roomName) {
            joinRoom(roomName);
            roomForm.style.display = 'none';
            videoContainer.style.display = 'block';
        } else {
            statusMessage.innerText = 'Please enter a valid room name';
        }
    });
});
