(function () {
    var shareOperation = null;
    var uploadOperation = null;

    var file = null;
    var data = null;
    var base64 = null;
    var canvas = null;
    var ctx = null;
    var promise = null;

    function activatedHandler(eventObject) {
        if (eventObject.detail.kind === Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {
            eventObject.setPromise(WinJS.UI.processAll());

            shareOperation = eventObject.detail.shareOperation;

            WinJS.Application.queueEvent({ type: "shareready" });
        }
    }

    function shareReady(eventArgs) {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');

        if (shareOperation.data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.storageItems)) {
            shareOperation.data.getStorageItemsAsync().then(function (storageItems) {
                file = storageItems.getAt(0);

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

                            initialize();
                            document.getElementById("upload").innerText = WinJS.Resources.getString('upload').value + ' (' + Math.round(size / 1024) + 'KB)';
                        });
                    }
                });
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
