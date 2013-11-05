(function () {
    'use strict';

    var file = null;
    var uploading = false;

    function backToTop() {
        document.getElementById('top').className = '';
        document.getElementById('uploader').className = 'hidden';
        document.getElementById("imageArea").className = 'hidden';
        document.getElementById("progress").innerText = '';

        file = null;
    }

    function preview(readStream) {
        document.getElementById("imageHolder").src = URL.createObjectURL(readStream, { oneTimeOnly: true });
        document.getElementById("imageArea").className = '';
    }

    function confirm() {
        document.getElementById('top').className = 'hidden';
        document.getElementById('uploader').className = '';

        file.openReadAsync().then(function (readStream) {
            if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].indexOf(file.fileType) !== -1) {
                preview(readStream);
            }

            document.getElementById("upload").innerText = WinJS.Resources.getString('upload').value + ' (' + Math.round(readStream.size / 1024) + 'KB)';
        });
    }

    function uploadRequest() {
        if (file === null || uploading === true) {
            return;
        }

        uploading = true;

        document.getElementById('upload').innerText = WinJS.Resources.getString('uploading').value + '...';
        
        var api = new Windows.Foundation.Uri('https://direct.yabumi.cc/api/images.txt');
        var uploader = new Windows.Networking.BackgroundTransfer.BackgroundUploader();

        uploader.setRequestHeader('user-agent', 'YabumiUploaderForWindows/1.0');

        var contentParts = [];

        var part = new Windows.Networking.BackgroundTransfer.BackgroundTransferContentPart('imagedata', encodeURI(file.name));
        part.setFile(file);

        contentParts.push(part);

        uploader.createUploadAsync(api, contentParts).then(function (uploadOperation) {
            uploadOperation.startAsync().then(
                function () {
                    uploading = false;
                    // complete
                    var responseInformation = uploadOperation.getResponseInformation();

                    var headers = responseInformation.headers;
                    var statusCode = responseInformation.statusCode;

                    if (statusCode === 200 || statusCode === 201) {
                        // OK
                        document.getElementById("upload").innerText = WinJS.Resources.getString('done').value;
                        document.getElementById("progress").innerText = headers['Location'];

                        if (document.getElementById("isEnableCopyURI").checked) {
                            var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
                            dataPackage.setText(headers['Location']);
                            Windows.ApplicationModel.DataTransfer.Clipboard.setContent(dataPackage);
                        }

                        if (document.getElementById("isEnableOpenURI").checked) {
                            Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(headers['X-Yabumi-Image-Edit-Url'])).then(function () {
                                backToTop();
                            });
                        } else {
                            backToTop();
                        }
                    } else {
                        document.getElementById("upload").innerText = 'Error: ' + statusCode;
                    }
                },
                function () {
                    uploading = false;
                    // error
                    document.getElementById("progress").innerText = WinJS.Resources.getString('failed to upload').value;
                }
            );
        });
    }

    function pickAImage() {
        var openPicker = new Windows.Storage.Pickers.FileOpenPicker();
        openPicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
        openPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;

        openPicker.fileTypeFilter.replaceAll([".png", ".jpg", ".jpeg", ".bmp", ".gif", ".svg", ".pdf"]);

        openPicker.pickSingleFileAsync().then(function (a) {
            if (a) {
                file = a;
                confirm();
            }
        });

    }

    function takeAPhoto() {
        var captureUI = new Windows.Media.Capture.CameraCaptureUI();
        captureUI.photoSettings.format = Windows.Media.Capture.CameraCaptureUIPhotoFormat.jpeg;
        captureUI.captureFileAsync(Windows.Media.Capture.CameraCaptureUIMode.photo).then(function (a) {
            if (a) {
                file = a;
                confirm();
            }
        });

    }

    function initialize() {
        document.getElementById('pick-a-image').addEventListener('click', pickAImage);
        document.getElementById('take-a-photo').addEventListener('click', takeAPhoto);
        document.getElementById("back-to-top").addEventListener("click", backToTop);
        document.getElementById("upload").addEventListener("click", uploadRequest);
    }

    function activated (eventObject) {
        if (eventObject.detail.kind === Windows.ApplicationModel.Activation.ActivationKind.launch) {
            eventObject.setPromise(WinJS.UI.processAll().then(function () {
                initialize();
            }));

            WinJS.Application.onsettings = function (e) {
                e.detail.applicationcommands = {
                    'privacypolicy': {
                        title: WinJS.Resources.getString('privacy').value,
                        href : 'privacy.html'
                    }
                };

                WinJS.UI.SettingsFlyout.populateSettings(e);
            }
        }
    }

    WinJS.Application.onloaded = function () {
        WinJS.Resources.processAll();
    };

    WinJS.Application.addEventListener('activated', activated, false);
    WinJS.Application.start();
})();
