// var socket = io.connect('http://' + document.domain + ':' + location.port);
// var roomId = MD5(moment().format('MMMM Do YYYY, HH:mm:ss'));
// socket.emit("join", {roomId: roomId});

var appAngular = angular.module("AppModule", ["ngSanitize", "pascalprecht.translate"]);
appAngular.config(["$translateProvider", function ($translateProvider) {
    var en_translations = {
        "language": "LANGUAGE",
        "language_2": "Language",
        "en": "English",
        "vi": "Vietnamese",
        "Speech to text": 'Speech to text - Conversation',
        "Quickly and accurately convert Vietnamese voice and audio into text": "Quickly and accurately convert Vietnamese voice and audio into text",
        "History": "History",
        "type": "Type",
        "file": "File",
        "result": "Result",
        "time": "Time",
        "Record": "Record",
        "Upload": "Upload",
        "Consecutive": "Consecutive",
        "No data": "No data",
        "content_conversation": "Content conversation",
        "modal_close": "Close",
        "NORTH": "NORTH",
        "SOUTH": "SOUTH",
        "CENTRAL": "CENTRAL",
    }

    var vi_translations = {
        "language": "NGÔN NGỮ",
        "language_2": "Ngôn ngữ",
        "en": "Tiếng anh",
        "vi": "Tiếng việt",
        "Speech to text": 'Chuyển đổi giọng nói thành văn bản',
        "Quickly and accurately convert Vietnamese voice and audio into text": "Chuyển đổi giọng nói và âm thanh tiếng Việt thành văn bản nhanh chóng và chính xác",
        "History": "Lịch sử",
        "type": "Loại",
        "file": "File âm thanh",
        "result": "Kết quả",
        "time": "Thời gian",
        "Record": "Ghi âm",
        "Upload": "Tải lên",
        "Consecutive": "Consecutive",
        "No data": "Không có dữ liệu",
        "content_conversation": "Nội dung hội thoại",
        "modal_close": "Đóng",
        "NORTH": "Giọng miền bắc",
        "SOUTH": "Giọng miền nam",
        "CENTRAL": "Giọng miền trung",
    }

    $translateProvider.translations('en', en_translations);
    $translateProvider.translations('vi', vi_translations);
    $translateProvider.preferredLanguage('en');

}]);
appAngular.controller("AppController", ["$scope", "$sce", "$interval", "commonService", "$timeout", "$translate", function ($scope, $sce, $interval, commonService, $timeout, $translate) {
    //iOS 9 style siri wave
    let siriWaveB = new SiriWave({
        container: document.getElementById('id-recording-audio'),
        // width: 1000,
        height: 50,
        speed: 0.0,
        amplitude: 1.2,
        autostart: true,
        style: 'ios9'
    });
    var siriWave = siriWaveB;
    var source;
    $scope.modalData = null;
    $scope.loading = true;
    $timeout(() => {
        $scope.loading = false;
        $timeout(() => {
            $('#id-loading').remove();
            $('html').css("overflow", "auto");
        }, 1000);
    }, 800);
    $scope.list_record = [];
    $scope.language = 'vi';
    $scope.audioContext = null;
    if (!!localStorage.getItem('language')) {
        $translate.use(localStorage.getItem('language'));
    } else {
        $translate.use('vi');
    }
    $scope.changeLanguage = function (lang) {
        localStorage.setItem('language', lang);
        $translate.use(lang);
    }
    $scope.initAudioContext = () => {
        if (!$scope.audioContext) {
            $scope.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if ($scope.audioContext.state === 'suspended') {
                $scope.audioContext.resume();
            }
        }
    }
    $scope.currentResult = '';
    // $scope.currentResult = {
    //     "content": [
    //         {
    //             "channel": "NHAN_VIEN",
    //             "text": "Xin chào",
    //         },
    //         {
    //             "channel": "KHACH_HANG",
    //             "text": "Vâng",
    //         },
    //         {
    //             "channel": "NHAN_VIEN",
    //             "text": "Tạm biệt",
    //         },
    //     ],
    //     "agent_info": {
    //         "gender": "MALE",
    //         "region": "NORTH",
    //     },
    //     "customer_info": {
    //         "gender": "FEMALE",
    //         "region": "SOUTH"
    //     }
    // }
    var mediaRecorder = null;
    var bufferDataMic = [];
    var countSilentDuration = 0;

    const SILENT_THRESHOLD = 1000;
    const SILENT_DURATION = 2;
    var dataApi = [];
    var intervalApi = null;
    $scope.$on('$destroy', function () { // Gets triggered when the scope is destroyed.
        $interval.cancel($scope.mic.interval);
    });
    $scope.mic = {
        isStop: true,
        textButton: 'Consecutive',
        mediaRecorder: null,
        interval: null,
        timeSend: 5,
        bufferData: null,
        id: null,
        countTime: null,
        totalBlob: [],
        click: () => {
            if (!$scope.mic.isStop) {
                // $scope.mic.export();
                // bufferDataMic = [];
                $scope.mic.stop();
                return;
            }
            $scope.mic.start();
        },
        start: () => {
            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                alert("Allow microphone to record");
                return;
            }
            $scope.currentResult = '';
            $scope.mic.isStop = false;
            $scope.mic.textButton = 'Stop';
            $scope.mic.totalBlob = [];
            countSilentDuration = 0;

            $scope.initAudioContext();
            $scope.mic.id = MD5(moment().format('MMMM Do YYYY, HH:mm:ss'));
            // let countTime = 0;
            $scope.mic.countIndex = 0;
            $scope.list_record.push({
                id: $scope.mic.id,
                type: 1,
                audio: null,
                language: angular.copy($scope.language),
                time: new Date(),
                result: '',
                processing: true
            });
            $scope.mic.init();
            // $scope.mic.interval = $interval(() => {
            //     countTime += 1;
            //     if (countTime >= $scope.mic.timeSend) {
            //         countTime = 0;
            //     }
            // }, 1000);
            let bufferDataMicTempIndex = 0;
            let uploadFile = async () => {
                return new Promise(async (resolve, reject) => {
                    let start = bufferDataMicTempIndex;
                    let end = Math.min(bufferDataMicTempIndex + 70, bufferDataMic.length)
                    let bufferDataMicTemp = bufferDataMic.splice(start, end);
                    bufferDataMicTempIndex = end;

                    $scope.mic.countIndex += 1;
                    let blob = new Blob(bufferDataMicTemp, {type: 'audio/wav'});
                    let filename = $scope.mic.id + "_" + $scope.mic.countIndex + ".wav ";

                    let fd = new FormData();
                    fd.append("file", blob, filename);
                    fd.append("filename", filename);
                    fd.append("language", angular.copy($scope.language));
                    console.log("filename: " + filename);
                    console.log("start: " + start);
                    console.log("end: " + end);

                    await commonService.sendPostForm2("/upload/" + MD5(moment().format('MMMM Do YYYY, HH:mm:ss')), fd).then(async (data) => {
                        if (!!$scope.currentResult) {
                            $scope.currentResult += "<br>"
                        }
                        $scope.currentResult += data.result;
                        $scope.updateResult($scope.mic.id, data.result);
                        console.log("Done: " + filename);
                        // dataApi.shift();
                        resolve();
                    }, async (error) => {
                        console.error(error);
                        $scope.updateResult($scope.mic.id, "");
                        console.log("Error: " + filename);
                        // dataApi.shift();
                        resolve();
                    });
                })

            }
            intervalApi = async () => {
                return new Promise(async (resolve, reject) => {
                    if ($scope.mic.isStop) {
                        if (bufferDataMic.length > bufferDataMicTempIndex) {
                            await uploadFile();
                        }
                    }
                    if (bufferDataMic.length > (bufferDataMicTempIndex + 70)) {
                        await uploadFile();
                    }
                    $timeout(async () => {
                        await intervalApi();
                    }, 500);
                    resolve();
                })

            };
            intervalApi();
        },
        stop: () => {
            $scope.mic.isStop = true;
            $scope.mic.textButton = 'Consecutive';
            mediaRecorder.stop();
            $scope.mic.countIndex = 0;
            mediaRecorder.ondataavailable = null;
            $interval.cancel($scope.mic.interval);

            let blob = new Blob(bufferDataMic, {type: 'audio/wav'});
            bufferDataMic = [];
            let url = URL.createObjectURL(blob);
            let au = document.createElement('audio');
            //add controls to the <audio> element
            au.controls = true;
            au.src = url;
            let div = document.createElement('div');
            div.appendChild(au);
            div.appendChild(document.createTextNode($scope.mic.id + ".wav "))

            //add the new audio element to div
            $scope.list_record.forEach(item => {
                if (item.id == $scope.mic.id) {
                    item.audio = $sce.trustAsHtml(div.innerHTML);
                    item.processing = false;
                }
            })
        },
        init: () => {
            // if (!!mediaRecorder) {
            //     if (mediaRecorder.state == 'recording') {
            //         mediaRecorder.stop();
            //         mediaRecorder.ondataavailable = null;
            //         $scope.mic.export();
            //         bufferDataMic = [];
            //     }
            // }
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({video: false, audio: true}).then(function (stream) {
                    mediaRecorder = new MediaRecorder(stream);

                    mediaRecorder.ondataavailable = function (e) {
                        bufferDataMic.push(e.data);
                    }
                    mediaRecorder.start(10);

                    var audioInput = $scope.audioContext.createMediaStreamSource(stream);
                    var bufferSize = 0;

                    let recorder = $scope.audioContext.createScriptProcessor(bufferSize, 1, 1);

                    recorder.onaudioprocess = function (e) {
                        if (!$scope.mic.isStop) {
                            if (countSilentDuration > SILENT_DURATION) {
                                stop();
                                countSilentDuration = 0;
                                return;
                            }

                            let buffer = e.inputBuffer.getChannelData(0);
                            drawBuffer(buffer);
                            var int16ArrayData = convertFloat32ToInt16(buffer);
                            countSilentDuration += int16ArrayData.length / $scope.audioContext.sampleRate;
                            for (var i = 0; i < int16ArrayData.length; i++) {
                                if (Math.abs(int16ArrayData[i]) > SILENT_THRESHOLD) {
                                    countSilentDuration = 0;
                                    break;
                                }
                            }
                        }
                    };
                    audioInput.connect(recorder);
                    recorder.connect($scope.audioContext.destination);
                }).catch(function (e) {
                    console.log("Error in getUserMedia: ");
                    console.log(e);
                });
            }

        },
        export: () => {
            if (!!bufferDataMic.length > 0) {
                console.log(bufferDataMic.length);
                try {
                    $scope.mic.countIndex += 1;
                    $scope.mic.totalBlob = $scope.mic.totalBlob.concat(bufferDataMic);
                    let blob = new Blob(bufferDataMic, {type: 'audio/wav'});
                    bufferDataMic = [];
                    let filename = $scope.mic.id + "_" + $scope.mic.countIndex + ".wav ";

                    let fd = new FormData();
                    fd.append("file", blob, filename);
                    fd.append("filename", filename);

                    dataApi.push(fd);
                    //
                    // commonService.sendPostForm("/upload", fd, (data) => {
                    //     console.log("export----");
                    //     $timeout(() => {
                    //         if (!!$scope.currentResult) {
                    //             $scope.currentResult += "<br>"
                    //         }
                    //         $scope.currentResult += data.result;
                    //         $scope.updateResult($scope.mic.id, data.result);
                    //     }, 0)
                    // }, (error) => {
                    //     $timeout(() => {
                    //         $scope.updateResult($scope.mic.id, 'Error');
                    //     }, 0)
                    // });
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }
    var processorSiri = null;
    $scope.record = {
        rec: null,
        gumStream: null,
        recorder: null,
        start: () => {
            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                alert("Allow microphone to record");
                return;
            }

            $scope.currentResult = '';
            $scope.initAudioContext();
            $scope.record.buttons.start.disabled = true;
            $scope.record.buttons.pause.disabled = false;
            $scope.record.buttons.stop.disabled = false;
            navigator.mediaDevices.getUserMedia({audio: true, video: false}).then((stream) => {
                $scope.record.gumStream = stream;
                let audioInput = $scope.audioContext.createMediaStreamSource(stream);
                $scope.record.rec = new Recorder(audioInput, {numChannels: 1});
                $scope.record.rec.record();

                // let bufferSize = 0;
                // $scope.record.recorder = $scope.audioContext.createScriptProcessor(bufferSize, 1, 1);
                // siriWave.start();
                // $scope.record.recorder.onaudioprocess = (e) => {
                //     // if ($scope.record.rec.recording) {
                //     //     let buffer = e.inputBuffer.getChannelData(0);
                //     //     drawBuffer(buffer);
                //     // } else {
                //     //     return;
                //     // }
                // };
                // audioInput.connect($scope.record.recorder);
                // $scope.record.recorder.connect($scope.audioContext.destination);
                //context depending on browser(Chrome/Firefox)
                let context = new (window.AudioContext || window.webkitAudioContext)();
                //create source for sound input.
                source = context.createMediaStreamSource(stream);
                //create processor node.
                processorSiri = context.createScriptProcessor(1024, 1, 1);
                //create analyser node.
                let analyser = context.createAnalyser();
                //set fftSize to 4096
                analyser.fftSize = 4096;
                //array for frequency data.
                let myDataArray = new Float32Array(analyser.frequencyBinCount);

                //connect source->analyser->processor->destination.
                source.connect(analyser);
                analyser.connect(processorSiri);
                processorSiri.connect(context.destination);

                //start siriwave
                siriWave.start();

                //event for change in audio data from source.
                processorSiri.onaudioprocess = function (e) {

                    let amplitude = 0;
                    let frequency = 0;

                    //copy frequency data to myDataArray from analyser.
                    analyser.getFloatFrequencyData(myDataArray);

                    //get max frequency which is greater than -100 dB.
                    myDataArray.map((item, index) => {
                        let givenFrequencyDB = item;

                        if (givenFrequencyDB > -100) {
                            frequency = Math.max(index, frequency);
                        }
                    });

                    //multipy frequency by resolution and divide it to scale for setting speed.
                    frequency = ((1 + frequency) * 11.7185) / 24000;
                    //set the speed for siriwave
                    siriWave.setSpeed(frequency);

                    //find the max amplituded
                    e.inputBuffer.getChannelData(0).map((item) => {
                        amplitude = Math.max(amplitude, Math.abs(item));
                    });

                    //output buffer data.
                    //console.log(e.outputBuffer.getChannelData(0));

                    //scale amplituded from [-1, 1] to [0, 10].
                    amplitude = Math.abs(amplitude * 10);

                    //if amplitude is greater than 0 then set siriwave amplitude else set to 0.0.
                    if (amplitude >= 0) {
                        siriWave.setAmplitude(amplitude);
                    } else {
                        siriWave.setAmplitude(0.0);
                    }

                };
            });
        },
        pause: () => {
            if ($scope.record.rec.recording) {
                siriWave.stop();
                $scope.record.rec.stop();
                $scope.record.buttons.pause.icon = 'play_arrow';
            } else {
                siriWave.start();
                $scope.record.rec.record();
                $scope.record.buttons.pause.icon = 'pause';
            }
        },
        stop: () => {
            $('#loading-div').loading('start');
            siriWave.stop();
            processorSiri.disconnect();
            source.disconnect();
            // $scope.record.recorder.onaudioprocess = null;
            $scope.record.buttons.start.disabled = false;
            $scope.record.buttons.pause.disabled = true;
            $scope.record.buttons.stop.disabled = true;

            $scope.record.rec.stop();
            $scope.record.gumStream.getAudioTracks()[0].stop();

            //create the wav blob and pass it on to createDownloadLink
            $scope.record.rec.exportWAV((blob) => {
                let id = MD5(moment().format('MMMM Do YYYY, HH:mm:ss'));
                let url = URL.createObjectURL(blob);
                let au = document.createElement('audio');
                let div = document.createElement('div');
                let link = document.createElement('a');

                //name of .wav file to use during upload and download (without extendion)
                let filename = id + ".wav";

                //add controls to the <audio> element
                au.controls = true;
                au.src = url;

                //save to disk link
                link.href = url;
                link.download = filename; //download forces the browser to donwload the file using the  filename
                link.innerHTML = "Save to disk";

                //add the new audio element to div
                div.appendChild(au);
                div.appendChild(document.createTextNode(filename))

                $scope.$apply(() => {
                    $scope.list_record.push({
                        id: id,
                        type: 3,
                        language: angular.copy($scope.language),
                        audio: $sce.trustAsHtml(div.innerHTML),
                        time: new Date(),
                        result: '',
                        processing: true
                    });
                });
                let fd = new FormData();
                fd.append("file", blob, filename);
                fd.append("language", angular.copy($scope.language));
                commonService.sendPostForm("/upload-stt-conversation", fd, (data) => {
                    $timeout(() => {
                        $scope.currentResult = data;
                        $scope.updateResult(id, data);
                    }, 0);
                    $('#loading-div').loading('stop');
                }, (error) => {
                    $timeout(() => {
                        $scope.updateResult(id, 'Error');
                        $('#loading-div').loading('stop');
                    }, 0)
                });
            });
        },
        buttons: {
            start: {
                disabled: false
            },
            pause: {
                disabled: true,
                icon: "pause"
            },
            stop: {
                disabled: true
            }
        }
    }
    $scope.show = (item) => {
        $scope.modalData = item.result;
        $('#myModal').modal('show');
    }
    $scope.updateResult = (id, result) => {
        $scope.list_record.forEach(item => {
            if (item.id === id) {
                item.result = result;
                setTimeout(() => {
                    item.processing = false;
                    $scope.$apply();
                }, 1000);
            }
        });
    }

    $scope.changeStt = function () {
        $scope.currentResult = {
            "content": [
                {
                    "channel": "NHAN_VIEN",
                    "text": "Xin chào",
                },
                {
                    "channel": "KHACH_HANG",
                    "text": "Vâng",
                },
                {
                    "channel": "NHAN_VIEN",
                    "text": "Tạm biệt",
                },
            ],
            "agent_info": {
                "gender": "MALE",
                "region": "NORTH",
            },
            "customer_info": {
                "gender": "FEMALE",
                "region": "SOUTH"
            }
        }
        if (!$scope.mic.isStop) {
            $scope.mic.stop();
        }

        $scope.currentResult = '';
        let fileInput = $('#stt-file')[0];
        let supportedType = ["audio/wav", "audio/x-wav", "audio/x-m4a", "audio/m4a"];
        let fileObj = fileInput.files[0];
        if (fileObj && supportedType.indexOf(fileObj.type) > -1) {
            let id = MD5(moment().format('MMMM Do YYYY, HH:mm:ss'));

            let reader = new FileReader();
            reader.onload = function (ev) {

                $('#loading-div').loading('start');
                let blob = new Blob([new Uint8Array(ev.target.result)], {type: "audio/wav"});

                let url = URL.createObjectURL(blob);
                let au = document.createElement('audio');
                //add controls to the <audio> element
                au.controls = true;
                au.src = url;
                let div = document.createElement('div');
                div.appendChild(au)
                div.appendChild(document.createTextNode(fileObj.name));

                $scope.list_record.push({
                    id: id,
                    type: 2,
                    language: angular.copy($scope.language),
                    audio: $sce.trustAsHtml(div.innerHTML),
                    time: new Date(),
                    result: null,
                    processing: true
                });
                $scope.$apply();


                let fd = new FormData();
                fd.append('file', fileObj);
                fd.append("language", angular.copy($scope.language));

                commonService.sendPostForm("/upload-stt-conversation", fd, (data) => {
                    $timeout(function () {
                        $scope.currentResult = data;
                        $scope.updateResult(id, data);
                    }, 0);
                    $('#stt-file').val('');
                    $('#loading-div').loading('stop');
                }, (error) => {
                    $timeout(function () {
                        $scope.updateResult(id, 'Error');
                    }, 0);
                    $('#loading-div').loading('stop');
                });
            };
            reader.readAsArrayBuffer(fileObj);
        } else {
            alert('The file format is not supported')
        }

    };
}]);

function convertFloat32ToInt16(float32ArrayData) {
    let l = float32ArrayData.length;
    let int16ArrayData = new Int16Array(l);
    while (l--) {
        int16ArrayData[l] = Math.min(1, float32ArrayData[l]) * 0x7FFF;
    }
    return int16ArrayData;
}

function drawBuffer(data) {
    let canvas = document.getElementById("canvas-wave"),
        width = canvas.width,
        height = canvas.height,
        context = canvas.getContext('2d');

    context.clearRect(0, 0, width, height);
    let step = Math.ceil(data.length / width);
    let amp = height / 2;
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            let datum = data[(i * step) + j];
            if (datum < min)
                min = datum;
            if (datum > max)
                max = datum;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
}

appAngular.filter('reverse', function () {
    return function (items) {
        return items.slice().reverse();
    };
});
appAngular.service(
    "commonService",
    function ($http, $q) {
        // Return public API.
        return ({
            sendPostReq: sendPostReq,
            sendPostForm: sendPostForm,
            sendPostForm2: sendPostForm2,
            sendGetReq: sendGetReq,
            isArray: isArray,
            isEmpty: isEmpty,
        });

        // ---
        // PUBLIC METHODS.
        // ---
        // Http post
        function sendPostReq(url, params, callbackFunc, errCallback) {
            $http.post(url, params)
                .then(function (response) {
                    callbackFunc && callbackFunc(response.data);
                }, function (error) {
                    errCallback && errCallback(error.data);
                });
        }

        async function postData(url = '', data = {}) {
            // Default options are marked with *
            const response = await fetch(url, {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                // headers: {'Content-Type': undefined, transformRequest: angular.identity},
                body: data// body data type must match "Content-Type" header
            });
            return response.json(); // parses JSON response into native JavaScript objects
        }

        function sendPostForm2(url, params) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url,
                    data: params,
                    processData: false,
                    contentType: false,
                    type: 'POST',
                    success: function (data) {
                        resolve(data);
                    },
                    error: function (error) {
                        console.error(error);
                        reject(error);
                    }
                });
                // $http.post(url, params, {
                //     transformRequest: angular.identity,
                //     headers: {'Content-Type': undefined}
                // })
                //     .then(function (response) {
                //         resolve(response.data);
                //     }, function (error) {
                //         console.error(error);
                //         reject(error.data);
                //     });
            })

        }

        function sendPostForm(url, params, callbackFunc, errCallback) {
            let deferred = $q.defer();

            $http.post(url, params, {
                transformRequest: angular.identity,
                headers: {'Content-Type': undefined}
            })
                .then(function (response) {
                    callbackFunc && callbackFunc(response.data);
                    deferred.resolve(response);
                }, function (error) {
                    deferred.reject(error);
                    errCallback && errCallback(error.data);
                });
            return deferred.promise;
        }

        // Http get
        function sendGetReq(url, callbackFunc, errCallback = null) {
            $http.get(url)
                .success(function (response) {
                    callbackFunc && callbackFunc(response);
                })
                .error(function (error) {
                    errCallback && errCallback(error.data);
                });
        }

        // Check object is an array or not
        function isArray(obj) {
            if (obj == undefined) return false;
            return Object.prototype.toString.call(obj) === '[object Array]';
        }

        // Check an object is empty or not
        function isEmpty(obj) {
            if (obj == undefined || !obj) return true;
            return Object.keys(obj).length === 0;
        }

        function handleError(response) {
            return ($q.reject(response.data));
        }

        function handleSuccess(response) {
            return (response.data);
        }

        function numberWithCommas(x) {
            return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    }
);
