(function () {
    'use strict';

    var uploadOperation = null;

    var file = null;
    var data = null;
    var base64 = null;
    var canvas = null;
    var ctx = null;
    var promise = null;
    var uploading = false;

    function backToTop() {
        document.getElementById('top').className = '';
        document.getElementById('uploader').className = 'hidden';
        document.getElementById("imageArea").className = 'hidden';
        document.getElementById("progress").innerText = '';

        file = null;
    }

    function preview() {
        file.openAsync(Windows.Storage.FileAccessMode.read).then(function (readStream) {
            var size = readStream.size;
            var maxuint32 = 4294967295;

            if (size <= maxuint32) {
                var dataReader = new Windows.Storage.Streams.DataReader(readStream);
                dataReader.loadAsync(size).then(function () {
                    var b = data = dataReader.readBuffer(size);
                    base64 = Windows.Security.Cryptography.CryptographicBuffer.encodeToBase64String(b);

                    dataReader.close();

                    document.getElementById("imageHolder").src = 'data:image;base64,' + base64;
                    document.getElementById("imageArea").className = '';

                    document.getElementById("upload").innerText = WinJS.Resources.getString('upload').value + ' (' + Math.round(size / 1024) + 'KB)';
                });
            }
        });
    }

    function confirm() {
        document.getElementById('top').className = 'hidden';
        document.getElementById('uploader').className = '';

        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].indexOf(file.fileType) !== -1) {
            preview();
        } else {
            file.openAsync(Windows.Storage.FileAccessMode.read).then(function (readStream) {
                document.getElementById("upload").innerText = WinJS.Resources.getString('upload').value + ' (' + Math.round(readStream.size / 1024) + 'KB)';
            });
        }
    }

    function uploadRequest() {
        if (file === null || uploading === true) {
            return;
        }

        uploading = true;

        document.getElementById('upload').innerText = WinJS.Resources.getString('uploading').value + '...';
        
        var api = new Windows.Foundation.Uri('https://direct.yabumi.cc/api/image.txt');
        var uploader = new Windows.Networking.BackgroundTransfer.BackgroundUploader();

        uploader.setRequestHeader('user-agent', 'YabumiUploaderForWindows/1.0');

        var contentParts = [];

        var part = new Windows.Networking.BackgroundTransfer.BackgroundTransferContentPart('imagedata', encodeURI(file.name));
        part.setFile(file);

        contentParts.push(part);

        uploader.createUploadAsync(api, contentParts).then(function (upload) {
            uploadOperation = upload;
            
            promise = uploadOperation.startAsync().then(
                function () {
                    // complete
                    var responseInformation = uploadOperation.getResponseInformation();

                    var headers = responseInformation.headers;
                    var statusCode = responseInformation.statusCode;

                    if (statusCode === 200) {
                        // OK
                        document.getElementById("upload").innerText = WinJS.Resources.getString('done').value;
                        document.getElementById("progress").innerText = headers['X-Yabumi-Image-Url'];

                        if (document.getElementById("isEnableCopyURI").checked) {
                            var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
                            dataPackage.setText(headers['X-Yabumi-Image-Url']);
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
                    // error
                    document.getElementById("progress").innerText = WinJS.Resources.getString('failed to upload').value;
                }
            );
        });
    }

    function pickAImage() {
        // Create the picker object and set options
        var openPicker = new Windows.Storage.Pickers.FileOpenPicker();
        openPicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
        openPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;
        // Users expect to have a filtered view of their folders depending on the scenario.
        // For example, when choosing a documents folder, restrict the filetypes to documents for your application.
        openPicker.fileTypeFilter.replaceAll([".png", ".jpg", ".jpeg", ".bmp", ".gif", ".svg", ".pdf"]);

        // Open the picker for the user to pick a file
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
