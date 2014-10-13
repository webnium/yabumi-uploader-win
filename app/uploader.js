(function () {

    'use strict';

    var A = WinJS.Application;
    var BackgroundTransfer = Windows.Networking.BackgroundTransfer;
    var localSettings = Windows.Storage.ApplicationData.current.localSettings;
    var roamingSettings = Windows.Storage.ApplicationData.current.roamingSettings;
    var temporaryFolder = Windows.Storage.ApplicationData.current.temporaryFolder;
    var version = Windows.ApplicationModel.Package.current.id.version;
    var versionString = version.major + '.' + version.minor + '.' + version.build + '.' + version.revision;

    var _L = function (string) {
        return WinJS.Resources.getString(string).value;
    };

    var app = window.app = {
        status: {
            initialized: false,
            uploadable: false,
            croppable: false,
            uploading: false,
            uploaded: false,
            cancelable: true,
            fromTarget: false
        },
        data: {
            uploadFile: null,
            uploadFileObjectURL: ''
        },
        f: {},
        view: {},
        ui: {},
        timer: {}
    };

    //
    // functions
    //

    app.f.getApiRoot = function (isGetRequest) {

        if (isGetRequest) {
            return 'https://' + (roamingSettings.values['config.apiRoot'] || 'yabumi.cc/api/');
        } else {
            return 'https://' + (roamingSettings.values['config.apiRoot'] || 'direct.yabumi.cc/api/');
        }
    };

    app.f.init = function () {

        if (app.status.initialized === true) {
            return;
        }
        app.status.initialized = true;

        // get static elements
        app.view.body = document.getElementById('body');
        app.view.preview = flagrate.Element.extend(document.getElementById('preview'));

        // create AppBar
        app.view.appBar = flagrate.createElement('div', { id: 'app-bar' }).insertTo(app.view.body);

        app.view.uploadButton = flagrate.createElement('button', { disabled: true });
        app.view.croppingButton = flagrate.createElement('button', { disabled: true });
        app.view.cancelButton = flagrate.createElement('button');

        app.ui.appBar = new WinJS.UI.AppBar(
            app.view.appBar,
            {
                commands: [
                    new WinJS.UI.AppBarCommand(app.view.croppingButton, {
                        section: 'global',
                        icon: 'crop',
                        label: _L('cropping'),
                        tooltip: _L('cropping') + ' (C)',
                        onclick: app.f.cropping
                    }),
                    new WinJS.UI.AppBarCommand(app.view.uploadButton, {
                        section: 'global',
                        icon: 'upload',
                        label: _L('upload'),
                        tooltip: _L('upload') + ' (Enter)',
                        onclick: app.f.upload
                    }),
                    new WinJS.UI.AppBarCommand(app.view.cancelButton, {
                        section: 'selection',
                        icon: 'cancel',
                        label: _L('cancel'),
                        tooltip: _L('cancel') + ' (Esc)',
                        onclick: app.f.cancel
                    })
                ],
                sticky: true
            }
        );

        // get sources
        switch (window.location.search) {
            case '?camera':
                app.f.fromCamera();
                break;

            case '?file':
                app.f.fromFile();
                break;

            default:
                if (app.shareOperation) {
                    app.status.fromTarget = true;
                    app.f.fromTarget();
                }
        }

        // show AppBar
        setTimeout(function () {
            app.ui.appBar.show();
        }, 1000);

        // keyboard shortcuts
        window.addEventListener('keydown', app.f.onKeydownHandler, true);
    };

    app.f.onKeydownHandler = function (e) {

        var active = document.activeElement && document.activeElement.tagName;

        if (active !== 'BODY' && active !== 'DIV' && active !== 'BUTTON') { return; }
        if (window.getSelection().toString() !== '') { return; }

        var activated = false;

        // BS:8 -> Back
        if (e.keyCode === 8 && app.status.fromTarget === false) {
            activated = true;
            if (app.status.cancelable === true) {
                window.history.back();
            }
        }

        // ENTER:13 -> Upload
        if (e.keyCode === 13 && active !== 'BUTTON') {
            activated = true;
            app.f.upload();
        }

        // ESC:27 -> Cancel
        if (e.keyCode === 27) {
            activated = true;
            app.f.cancel();
        }

        // c:67 -> Cropping
        if (e.keyCode === 67) {
            activated = true;
            app.f.cropping();
        }

        // CTRL + q:81 -> Quit
        if (e.ctrlKey && e.keyCode === 81) {
            activated = true;
            if (app.status.cancelable === true) {
                window.close();
            }
        }

        if (activated === true) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    app.f.fromCamera = function () {
        
        var captureUI = new Windows.Media.Capture.CameraCaptureUI();
        captureUI.photoSettings.format = Windows.Media.Capture.CameraCaptureUIPhotoFormat.jpeg;
        captureUI.captureFileAsync(Windows.Media.Capture.CameraCaptureUIMode.photo).then(function (file) {

            if (file) {
                app.f.prepare(file);
            } else {
                app.f.cancel();
            }
        });
    };

    app.f.fromFile = function () {
        
        var openPicker = new Windows.Storage.Pickers.FileOpenPicker();
        openPicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
        openPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;

        openPicker.fileTypeFilter.replaceAll(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf']);

        openPicker.pickSingleFileAsync().then(function (file) {

            if (file) {
                app.f.prepare(file);
            } else {
                app.f.cancel();
            }
        });
    };

    app.f.fromTarget = function () {

        app.view.cancelButton.remove();

        if (app.shareOperation.data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.storageItems)) {
            app.shareOperation.data.getStorageItemsAsync().then(function (storageItems) {

                app.f.prepare(storageItems.getAt(0));
            });
        } else {
            app.shareOperation.reportStarted();
            app.shareOperation.reportError(_L('error'));
        }
    };

    app.f.prepare = function (file) {

        if (file) {
            app.data.uploadFile = file;
        } else if (!app.data.uploadFile) {
            return;
        }

        app.status.uploadable = true;
        app.status.cancelable = true;
        app.view.uploadButton.disabled = false;
        app.view.cancelButton.disabled = false;
        
        if (['.jpg', '.jpeg', '.png'].indexOf(app.data.uploadFile.fileType.toLowerCase()) !== -1) {
            app.status.croppable = true;
            app.view.croppingButton.disabled = false;
        }

        if (['.svg', '.jpg', '.jpeg', '.png', '.gif'].indexOf(app.data.uploadFile.fileType.toLowerCase()) !== -1) {
            app.f.preview(app.data.uploadFile);
        } else {
            app.f.preview();
        }
    };

    app.f.preview = function (file) {

        app.view.preview.update();

        if (file) {
            var progress = flagrate.createElement('progress').insertTo(app.view.preview);

            file.openReadAsync().then(function (readStream) {

                app.data.uploadFileObjectURL = URL.createObjectURL(readStream);

                flagrate.createElement().setStyle({
                    backgroundImage: 'url(' + app.data.uploadFileObjectURL + ')'
                }).insertTo(app.view.preview);

                progress.remove();
            });
        } else {
            flagrate.createElement('h3').insertText(_L('note-no-preview')).insertTo(app.view.preview);
        }
    };

    app.f.cropping = function () {

        if (app.status.croppable === false || app.data.uploadFileObjectURL === '') {
            return;
        }
        app.status.croppable = false;
        app.status.uploadable = false;

        app.view.appBar.remove();

        var viewW = app.view.preview.getWidth();
        var viewH = app.view.preview.getHeight();
        var viewAR = viewW / viewH;
        var imgW = 0;
        var imgH = 0;
        var imgAR = 1;
        var ratio = 1;
        var cropX = 0;
        var cropY = 0;
        var cropW = 0;
        var cropH = 0;

        var croppingContainer = flagrate.createElement('div', { 'class': 'cropping-container' }).insertTo(app.view.preview);

        var canvas = flagrate.createElement('canvas').insertTo(croppingContainer);
        var context = canvas.getContext('2d');
        var img = flagrate.createElement('img', {
            src: app.data.uploadFileObjectURL
        });
        img.onload = function () {

            imgW = img.width;
            imgH = img.height;
            imgAR = imgW / imgH;

            setTimeout(init, 0);
        };

        var topLeftHandle = flagrate.createElement('div', { 'class': 'cropping-handle' }).insertTo(croppingContainer);
        var topRightHandle = flagrate.createElement('div', { 'class': 'cropping-handle' }).insertTo(croppingContainer);
        var bottomRightHandle = flagrate.createElement('div', { 'class': 'cropping-handle' }).insertTo(croppingContainer);
        var bottomLeftHandle = flagrate.createElement('div', { 'class': 'cropping-handle' }).insertTo(croppingContainer);

        var init = function () {

            if (imgAR > viewAR) {
                ratio = viewW / imgW;
            } else {
                ratio = viewH / imgH;
            }

            // init area
            cropX = Math.round(imgW * 0.2);
            cropY = Math.round(imgH * 0.2);
            cropW = Math.round(imgW * 0.5);
            cropH = Math.round(imgH * 0.5);

            update();

            // init events
            var pointerCount = 0;
            var initPointerX = 0;
            var initPointerY = 0;
            var initPositionX = 0;
            var initPositionY = 0;
            var initPositionW = 0;
            var initPositionH = 0;
            var panning = false;
            var resizingTL = false;
            var resizingTR = false;
            var resizingBL = false;
            var resizingBR = false;

            canvas.addEventListener('pointerdown', function (e) {

                if (pointerCount !== 0) {
                    return;
                }
                ++pointerCount;
                panning = true;

                e.stopPropagation();
                e.preventDefault();

                initPointerX = e.x;
                initPointerY = e.y;
                initPositionX = cropX;
                initPositionY = cropY;
            }, true);

            topLeftHandle.addEventListener('pointerdown', function (e) {

                if (pointerCount !== 0) {
                    return;
                }
                ++pointerCount;
                resizingTL = true;

                e.stopPropagation();
                e.preventDefault();

                initPointerX = e.x;
                initPointerY = e.y;
                initPositionX = cropX;
                initPositionY = cropY;
                initPositionW = cropW;
                initPositionH = cropH;
            }, true);

            topRightHandle.addEventListener('pointerdown', function (e) {

                if (pointerCount !== 0) {
                    return;
                }
                ++pointerCount;
                resizingTR = true;

                e.stopPropagation();
                e.preventDefault();

                initPointerX = e.x;
                initPointerY = e.y;
                initPositionX = cropX;
                initPositionY = cropY;
                initPositionW = cropW;
                initPositionH = cropH;
            }, true);

            bottomLeftHandle.addEventListener('pointerdown', function (e) {

                if (pointerCount !== 0) {
                    return;
                }
                ++pointerCount;
                resizingBL = true;

                e.stopPropagation();
                e.preventDefault();

                initPointerX = e.x;
                initPointerY = e.y;
                initPositionX = cropX;
                initPositionY = cropY;
                initPositionW = cropW;
                initPositionH = cropH;
            }, true);

            bottomRightHandle.addEventListener('pointerdown', function (e) {

                if (pointerCount !== 0) {
                    return;
                }
                ++pointerCount;
                resizingBR = true;

                e.stopPropagation();
                e.preventDefault();

                initPointerX = e.x;
                initPointerY = e.y;
                initPositionX = cropX;
                initPositionY = cropY;
                initPositionW = cropW;
                initPositionH = cropH;
            }, true);

            croppingContainer.addEventListener('pointerup', function (e) {

                if (pointerCount !== 1) {
                    return;
                }
                --pointerCount;
                panning = false;
                resizingTL = false;
                resizingTR = false;
                resizingBL = false;
                resizingBR = false;

                e.stopPropagation();
            }, true);

            croppingContainer.addEventListener('pointercancel', function (e) {

                if (pointerCount !== 1) {
                    return;
                }
                --pointerCount;
                panning = false;
                resizingTL = false;
                resizingTR = false;
                resizingBL = false;
                resizingBR = false;

                e.stopPropagation();
            }, true);

            croppingContainer.addEventListener('pointermove', function (e) {

                if (pointerCount !== 1) {
                    return;
                }

                e.stopPropagation();

                var x = initPointerX - e.x;
                var y = initPointerY - e.y;

                if (panning === true) {
                    cropX = initPositionX - Math.round(x / ratio);
                    cropY = initPositionY - Math.round(y / ratio);
                }
                if (resizingTL === true) {
                    cropX = initPositionX - Math.round(x / ratio);
                    cropY = initPositionY - Math.round(y / ratio);
                    cropW = initPositionW + Math.round(x / ratio);
                    cropH = initPositionH + Math.round(y / ratio);
                }
                if (resizingTR === true) {
                    cropY = initPositionY - Math.round(y / ratio);
                    cropW = initPositionW - Math.round(x / ratio);
                    cropH = initPositionH + Math.round(y / ratio);
                }
                if (resizingBL === true) {
                    cropX = initPositionX - Math.round(x / ratio);
                    cropW = initPositionW + Math.round(x / ratio);
                    cropH = initPositionH - Math.round(y / ratio);
                }
                if (resizingBR === true) {
                    cropW = initPositionW - Math.round(x / ratio);
                    cropH = initPositionH - Math.round(y / ratio);
                }

                for (var i = 0; i < 2; i++) {
                    if (cropX < 0) {
                        cropX = 0;
                    } else if (cropX + cropW > imgW) {
                        cropX = imgW - cropW;
                    }
                    if (cropY < 0) {
                        cropY = 0;
                    } else if (cropY + cropH > imgH) {
                        cropY = imgH - cropH;
                    }
                    if (cropW < 40) {
                        cropW = 40;
                    } else if (cropW > imgW - cropX) {
                        cropW = imgW - cropX;
                    }
                    if (cropH < 40) {
                        cropH = 40;
                    } else if (cropH > imgH - cropY) {
                        cropH = imgH - cropY;
                    }
                }

                update();
            }, true);
        };//<--init()

        var update = function () {

            var pX = Math.round(cropX * ratio);
            var pY = Math.round(cropY * ratio);
            var pW = Math.round(cropW * ratio);
            var pH = Math.round(cropH * ratio);

            if (imgAR > viewAR) {
                pY += Math.round(viewH / 2 - (imgH * ratio) / 2);
            } else {
                pX += Math.round(viewW / 2 - (imgW * ratio) / 2);
            }

            topLeftHandle.style.left = pX + 'px';
            topLeftHandle.style.top = pY + 'px';
            topRightHandle.style.left = pX + pW + 'px';
            topRightHandle.style.top = pY + 'px';
            bottomLeftHandle.style.left = pX + 'px';
            bottomLeftHandle.style.top = pY + pH + 'px';
            bottomRightHandle.style.left = pX + pW + 'px';
            bottomRightHandle.style.top = pY + pH + 'px';

            canvas.style.left = pX + 'px';
            canvas.style.top = pY + 'px';
            canvas.width = pW;
            canvas.height = pH;
            try {
                context.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, pW, pH);
            } catch (e) {
                console.error(e);
            }
        };//<--update()

        var back = function () {

            croppingContainer.remove();

            cropAppBar.remove();
            app.view.appBar.insertTo(app.view.body);
            app.status.croppable = true;
            app.status.uploadable = true;
        };

        var cropAppBar = flagrate.createElement('div', { id: 'app-bar' }).insertTo(app.view.body);
        new WinJS.UI.AppBar(
            cropAppBar,
            {
                commands: [
                    new WinJS.UI.AppBarCommand(flagrate.createElement('button'), {
                        section: 'global',
                        icon: 'accept',
                        label: 'OK',
                        onclick: function () {

                            canvas.width = cropW;
                            canvas.height = cropH;
                            context.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

                            var filename = app.data.uploadFile.name;

                            var temporaryFolder = Windows.Storage.ApplicationData.current.temporaryFolder;
                            temporaryFolder.createFileAsync(filename, Windows.Storage.CreationCollisionOption.replaceExisting)
                                .then(function (file) {

                                    if (!file) {
                                        return;
                                    }

                                    file.openAsync(Windows.Storage.FileAccessMode.readWrite).then(function (output) {

                                        // Get the IInputStream stream from the blob object of canvas
                                        var input = canvas.msToBlob().msDetachStream();

                                        // Copy the stream from the blob to the File stream 
                                        Windows.Storage.Streams.RandomAccessStream.copyAsync(input, output).then(function () {

                                            output.flushAsync().done(function () {

                                                input.close();
                                                output.close();

                                                temporaryFolder.getFileAsync(filename).then(function (file) {

                                                    URL.revokeObjectURL(app.data.uploadFileObjectURL);
                                                    app.f.prepare(file);
                                                    back();
                                                });
                                            });
                                        });
                                    });
                                });
                            //<--temporaryFolder.createFileAsync()
                        }
                    }),
                    new WinJS.UI.AppBarCommand(flagrate.createElement('button'), {
                        section: 'global',
                        icon: 'cancel',
                        label: _L('cancel'),
                        onclick: function () {

                            back();
                        }
                    })
                ],
                sticky: true
            }
        ).show();
    };//<--app.f.cropping()

    app.f.upload = function () {

        if (app.status.uploadable === false) {
            return;
        }
        app.status.uploading = true;
        app.status.uploadable = false;
        app.status.croppable = false;
        app.status.cancelable = false;
        app.view.uploadButton.disabled = true;
        app.view.croppingButton.disabled = true;
        app.view.cancelButton.disabled = true;

        if (app.shareOperation) {
            app.shareOperation.reportStarted();
        }

        // create mask
        app.view.mask = flagrate.createElement('div', { 'class': 'mask' }).insertTo(app.view.body);
        flagrate.createElement('progress', { 'class': 'win-ring' }).insertTo(app.view.mask);

        // process
        var imagesUri = new Windows.Foundation.Uri(app.f.getApiRoot() + 'images.txt');
        var uploader = new BackgroundTransfer.BackgroundUploader();
        uploader.setRequestHeader('user-agent', 'YabumiUploaderForWindows/' + versionString);
        
        var parts = [], part;
        part = new BackgroundTransfer.BackgroundTransferContentPart('imagedata', encodeURI(app.data.uploadFile.name));
        part.setFile(app.data.uploadFile);
        parts.push(part);

        // set expiration
        if (roamingSettings.values['config.defaultExpiration']) {
            part = new BackgroundTransfer.BackgroundTransferContentPart('expiresAt');
            var offset = parseInt(roamingSettings.values['config.defaultExpiration'], 10);
            if (offset === 0) {
                part.setText('null');
            } else {
                part.setText((new Date(Date.now() + offset)).toISOString());
            }
            parts.push(part);
        }

        // upload
        uploader.createUploadAsync(imagesUri, parts).then(function (uploadOperation) {

            uploadOperation.startAsync().then(function () {
                // complete

                app.status.uploading = false;

                var responseInformation = uploadOperation.getResponseInformation();
                var headers = responseInformation.headers;
                var statusCode = responseInformation.statusCode;

                if (statusCode === 200 || statusCode === 201) {
                    // success

                    app.status.uploaded = true;

                    var imageId = headers['X-Yabumi-Image-Id'];
                    var imagePin = headers['X-Yabumi-Image-Pin'];
                    var imageEditUrl = headers['X-Yabumi-Image-Edit-Url'];

                    // add to local history
                    localStorage.setItem(imageId, imagePin);

                    // copy to clipboard
                    if (roamingSettings.values['config.copyURLToClipboard']) {
                        var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
                        dataPackage.setText(headers['Location']);
                        Windows.ApplicationModel.DataTransfer.Clipboard.setContent(dataPackage);
                    }

                    // go to the uploaded image
                    var jump = function () {

                        if (localSettings.values['config.openSystemBrowserAfterUpload']) {
                            Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(imageEditUrl)).then(function () {

                                if (app.shareOperation) {
                                    app.shareOperation.reportCompleted();
                                } else {
                                    window.location.href = '/default.html';
                                }
                            });
                        } else if (localSettings.values['config.nothingOnUploaded']) {
                            if (!app.shareOperation) {
                                window.location.href = '/default.html';
                            }
                        } else {
                            if (app.shareOperation) {
                                var url = 'yabumi-uploader://viewer/' + imageId;
                                Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(url)).then(function () {

                                    app.shareOperation.reportCompleted();
                                });
                            } else {
                                var url = '/viewer.html?' + imageId + '#' + (app.status.fromTarget === true ? 'target' : '');
                                window.location.href = url;
                            }
                        }
                    };
                    
                    // add to remote history or,
                    if (roamingSettings.values['config.historyId']) {
                        var historyId = roamingSettings.values['config.historyId'];
                        var xhr = new XMLHttpRequest();
                        xhr.open('PUT', app.f.getApiRoot() + 'histories/' + historyId + '/images/' + imageId + '.json');

                        xhr.addEventListener('load', jump);

                        xhr.send(JSON.stringify({
                            pin: imagePin
                        }));
                    } else {
                        jump();
                    }
                } else {
                    // error

                    app.status.uploaded = false;

                    app.view.mask.remove();

                    if (app.shareOperation) {
                        app.shareOperation.reportError(_L('failed to upload') + ' (' + statusCode + ')');
                    }

                    new Windows.UI.Popups.MessageDialog(
                        _L('failed to upload') + ' (' + statusCode + ')',
                        _L('error')
                    ).showAsync().then(function () { app.f.prepare(); });
                }
            }, function () {
                // error

                app.status.uploading = false;

                app.view.mask.remove();

                if (app.shareOperation) {
                    app.shareOperation.reportError(_L('failed to upload'));
                }

                new Windows.UI.Popups.MessageDialog(
                    _L('failed to upload'),
                    _L('error')
                ).showAsync().then(function () { app.f.prepare(); });
            });//<--uploadOperation.startAsync()
        });//<--uploader.createUploadAsync()
    };//<--app.f.upload()

    app.f.cancel = function () {

        if (app.status.initialized === false || app.status.cancelable === false || app.status.fromTarget === true) {
            return;
        }

        window.location.href = '/default.html';
    };

    //
    // launch
    //

    A.onactivated = function (e) {

        if (e.detail.kind === Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {
            app.shareOperation = e.detail.shareOperation;
        }
    };
    
    A.onloaded = function (e) {

        setTimeout(app.f.init, 100);
    };

    //
    // start
    //

    A.start();

}());
