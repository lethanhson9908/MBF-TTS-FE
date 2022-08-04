var appAngular = angular.module("AppModule", [])
appAngular.controller("AppController", ["$scope", function ($scope) {
    $scope.test = 1;
}]);

(function ($) {
    var interval;
    var isStop = true;
    var recorder;
    var mediaRecorder;
    var ws;
    var buffer;
    var result;
    var audioContext;


    $("#btn-record-mic").click(async () => {
        if (!isStop) {
            stop();
            addText("Stop recored");
            console.log("Stop recored");
            return;
        }
        start();
        addText('Start record...');
        console.log('Start record...');
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state == 'suspended') {
                    audioContext.resume();
                }
                navigator.mediaDevices.getUserMedia({video: false, audio: true}).then(function (stream) {
                    /*draw html*/
                    let audioInput = audioContext.createMediaStreamSource(stream);
                    let bufferSize = 0;
                    recorder = audioContext.createScriptProcessor(bufferSize, 1, 1);

                    recorder.onaudioprocess = function (e) {
                        if (!isStop) {
                            buffer = e.inputBuffer.getChannelData(0);
                            drawBuffer(buffer);
                        }
                    };
                    audioInput.connect(recorder);
                    recorder.connect(audioContext.destination);
                }).catch(function (e) {
                    console.log("Error in getUserMedia: ");
                    addText("Error in getUserMedia: ");
                    console.log(e);
                    addText(e);
                });
            }
        } catch (e) {
            addText(e);
        }

        initWebSocket(audioContext.sampleRate);
    });

    function sendBinaryFile(bufferData) {
        console.log('sendBinaryFile ...');
        addText('sendBinaryFile ...');
        let reqTemp = new XMLHttpRequest();
        reqTemp.open("POST", 'https://demo.fpt.ai/hmi/asr', true);
        reqTemp.onload = function (oEvent) {
            $('#page-content').loading('stop');
            if (reqTemp.status == 429) {
                showFlashError('Demo STT out of daily quota');
                return
            } else if (reqTemp.status == 413) {
                alert('File is too large, please choose the file having max size is 5MB');
                return
            } else if (reqTemp.status != 200) {
                alert('Error ! Please try again');
                return
            }
            result = JSON.parse(reqTemp.responseText);
            if (result.hypotheses != undefined && result.hypotheses.length > 0) {
                $('#transcripted-text').html(result.hypotheses[0].utterance);
                $('#stt-file').val('');
            }
        };

        let data = new FormData();
        data.append('file', new Blob(bufferData, {type: "audio/wav"}));
        data.append('token', "6Lc1vJQUAAAAAGktFIQ-6hbHTVQXHWF174WTMjDE");
        // The FileReader returns us the bytes from the computer's file system as an ArrayBuffer
        // reqTemp.send(reader.result);
        reqTemp.send(data);
    }

    function addText(text) {
        let res = $('#transcripted-text').html();
        res += "\n" + text
        $('#transcripted-text').html(res);
    }

    function initWebSocket(sampleRate) {
        addText("initWebSocket");
        start();
        result = $('#transcripted-text').html();
        // ws = new WebSocket("wss://127.0.0.1:5678?content-type=audio/x-raw,+layout=(string)interleaved,+rate=(int)" + sampleRate + ",+format=(string)S16LE,+channels=(int)1");
        addText("wss://" + location.hostname + ":5678/")
        ws = new WebSocket("wss://" + location.hostname + ":5678/");
        ws.onopen = function () {
            console.log("Opened connection to websocket");
            addText("Opened connection to websocket");
        };

        ws.onclose = function () {
            console.log("Websocket closed");
            addText("Websocket closed");
            stop();
        };

        ws.onmessage = function (e) {
            return;
            let resp = jQuery.parseJSON(e.data);
            if (resp.status == 0 && resp.result && resp.result.hypotheses.length > 0) {
                var text = resp.result.hypotheses[0].transcript;
                if (text == '<unk>.') {
                    return;
                }
                if (resp.result.final) {
                    result += text + "\n";
                    $('#transcripted-text').html(result);
                    return;
                }

                $('#transcripted-text').html(isStop ? result : result + text);
            }
        };

        return ws
    }

    function start() {
        isStop = false;
        $("#btn-record-mic").html('<strong style="color: #F00;">Stop Record</strong>');
    }

    function stop() {
        isStop = true;
        $('#transcripted-text').html(result);
        $("#btn-record-mic").html('Record audio');
    }

    function convertFloat32ToInt16(float32ArrayData) {
        let l = float32ArrayData.length;
        let int16ArrayData = new Int16Array(l);
        while (l--) {
            int16ArrayData[l] = Math.min(1, float32ArrayData[l]) * 0x7FFF;
        }
        return int16ArrayData;
    }

    function drawBuffer(data) {
        var canvas = document.getElementById("canvas-wave"),
            width = canvas.width,
            height = canvas.height,
            context = canvas.getContext('2d');

        context.clearRect(0, 0, width, height);
        var step = Math.ceil(data.length / width);
        var amp = height / 2;
        for (var i = 0; i < width; i++) {
            var min = 1.0;
            var max = -1.0;
            for (var j = 0; j < step; j++) {
                var datum = data[(i * step) + j];
                if (datum < min)
                    min = datum;
                if (datum > max)
                    max = datum;
            }
            context.fillStyle = '#ffffff';
            context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
    }

    $('#stt-file').on('change', function () {
        if (!isStop) {
            closeWS();
            stop();
        }

        var fileInput = $('#stt-file')[0];
        var supportedType = ["audio/wav", "audio/x-wav"];
        var fileObj = fileInput.files[0];
        if (fileObj && supportedType.indexOf(fileObj.type) > -1) {
            $('#page-content').loading('start');
            let reqTemp = new XMLHttpRequest();
            reqTemp.open("POST", '/upload', true);
            reqTemp.onload = function (oEvent) {
                $('#page-content').loading('stop');
                if (reqTemp.status == 429) {
                    showFlashError('Demo STT out of daily quota');
                    return
                } else if (reqTemp.status == 413) {
                    alert('File is too large, please choose the file having max size is 5MB');
                    return
                } else if (reqTemp.status != 200) {
                    alert('Error ! Please try again');
                    return
                }
                result = JSON.parse(reqTemp.responseText);
                $('#transcripted-text').html(result['result']);
                $('#stt-file').val('');
            };

            var reader = new FileReader();
            reader.onload = function (ev) {
                let data = new FormData();
                data.append('file', fileObj);
                data.append('token', "6Lc1vJQUAAAAAGktFIQ-6hbHTVQXHWF174WTMjDE");
                // The FileReader returns us the bytes from the computer's file system as an ArrayBuffer
                // reqTemp.send(reader.result);
                reqTemp.send(data);
            };
            reader.readAsArrayBuffer(fileObj);
        } else {
            alert('The file format is not supported')
        }

    });

    function showFlashError(msg) {
        $('#stt-flash-error').text(msg);
        setTimeout(function () {
            $('#stt-flash-error').text('');
        }, 5000)
    };
})(jQuery);
