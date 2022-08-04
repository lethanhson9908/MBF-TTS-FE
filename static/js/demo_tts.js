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
        "Text To Speech": 'Text To Speech',
        "Quickly and accurately convert Vietnamese voice and audio into text": "Quickly and accurately convert Vietnamese voice and audio into text",
        "History": "History",
        "text": "Text",
        "file": "File",
        "result": "Result",
        "time": "Time",
        "Record": "Record",
        "Convert": "Convert",
        "error": "Error",
        "No data": "No data"
    }

    var vi_translations = {
        "language": "NGÔN NGỮ",
        "language_2": "Ngôn ngữ",
        "en": "Tiếng anh",
        "vi": "Tiếng việt",
        "Text To Speech": 'Chuyển đổi văn bản thành giọng nói ',
        "Quickly and accurately convert Vietnamese voice and audio into text": "Chuyển đổi giọng nói và âm thanh tiếng Việt thành văn bản nhanh chóng và chính xác",
        "History": "Lịch sử",
        "text": "Văn bản",
        "file": "File âm thanh",
        "result": "Kết quả",
        "time": "Thời gian",
        "Record": "Ghi âm",
        "Convert": "Chuyển đổi",
        "error": "Lỗi trong quá trình chuyển đổi dữ liệu",
        "No data": "Không có dữ liệu"
    }

    $translateProvider.translations('en', en_translations);
    $translateProvider.translations('vi', vi_translations);
    $translateProvider.preferredLanguage('en');

}]);
appAngular.controller("AppController", ["$scope", "$sce", "$interval", "commonService", "$timeout", "$translate", function ($scope, $sce, $interval, commonService, $timeout, $translate) {
    $scope.list_record = [];
    $scope.loading = true;
    $timeout(() => {
        $scope.loading = false;
        $timeout(() => {
            $('#id-loading').remove();
            $('html').css("overflow", "auto");
        }, 1000);
    }, 800);
    $scope.language = 'vi';
    if (!!localStorage.getItem('language')) {
        $translate.use(localStorage.getItem('language'));
    } else {
        $translate.use('vi');
    }
    $scope.changeLanguage = function (lang) {
        localStorage.setItem('language', lang);
        $translate.use(lang);
    }
    $scope.text = '';
    $scope.convert = () => {
        $scope.currentResult = null;
        $scope.text = $scope.text.trim();
        if (!$scope.text) {
            alert("Nhập đoạn văn bản muốn chuyển đổi");
            return;
        }
        $('#loading-div').loading('start');
        commonService.sendPostReq("/convert-tts", {text: $scope.text}, (data) => {
            $scope.currentResult = data['file'];
            $scope.list_record.push({
                text: angular.copy($scope.text),
                path: data['file'],
                time: new Date()
            });

            $('#loading-div').loading('stop');
        }, (error) => {
            $scope.currentResult = 'error';
            $('#loading-div').loading('stop');
        });
    }
}]);
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
            // let req = new XMLHttpRequest;
            // req.open("POST", '/upload', true);
            // req.onload = function (oEvent) {
            //     if (req.readyState === 4 && req.status === 200) {
            //         callbackFunc && callbackFunc(JSON.parse(req.responseText));
            //         req = null;
            //     }
            //     if (req.readyState != 4) {
            //         req.abort();
            //     }
            // };
            // req.send(params);
            // postData('/upload', params)
            //     .then(data => {
            //         callbackFunc && callbackFunc(data);
            //     }).catch((error) => {
            //     errCallback && errCallback(error);
            // });
            //
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
