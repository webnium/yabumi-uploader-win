(function () {
    var shareOperation = null;

    var file = null;

    function activatedHandler(eventObject) {
        if (eventObject.detail.kind === Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {
            eventObject.setPromise(WinJS.UI.processAll());

            shareOperation = eventObject.detail.shareOperation;

            WinJS.Application.queueEvent({ type: "shareready" });
        }
    }

    function shareReady(eventArgs) {
        if (shareOperation.data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.storageItems)) {
            shareOperation.data.getStorageItemsAsync().then(function (storageItems) {
                file = storageItems.getAt(0);

                try {
                    file.openReadAsync().then(function (readStream) {
                        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].indexOf(file.fileType) !== -1) {
                            document.getElementById("imageHolder").src = URL.createObjectURL(readStream, { oneTimeOnly: true });
                            document.getElementById("imageArea").className = '';
                        }

                        initialize();
                        document.getElementById("upload").innerText = WinJS.Resources.getString('upload').value + ' (' + Math.round(readStream.size / 1024) + 'KB)';
                    });
                } catch (e) {
                    initialize();
                    document.getElementById("upload").innerText = WinJS.Resources.getString('upload').value;
                }
            });
        }
    }

    function uploadRequest() {
        if (file === null) {
            return;
        }

        shareOperation.reportStarted();

        document.getElementById('upload').removeEventListener('click', uploadRequest);
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
                                shareOperation.reportCompleted();
                            });
                        } else {
                            shareOperation.reportCompleted();
                        }
                    } else {
                        document.getElementById("upload").innerText = 'Error: ' + statusCode;

                        shareOperation.reportError('Error: ' + statusCode);
                    }
                },
                function () {
                    // error
                    shareOperation.reportError(WinJS.Resources.getString('failed to upload').value);
                },
                function () {
                    // progress
                }
            );
        });
    }

    WinJS.Application.onloaded = function () {
        WinJS.Resources.processAll();
    };

    WinJS.Application.addEventListener("activated", activatedHandler, false);
    WinJS.Application.addEventListener("shareready", shareReady, false);
    WinJS.Application.start();

    function initialize() {
        document.getElementById("upload").addEventListener("click", uploadRequest, false);
    }
})();
