(function () {

    'use strict';

    var A = WinJS.Application;
    var localSettings = Windows.Storage.ApplicationData.current.localSettings;
    var roamingSettings = Windows.Storage.ApplicationData.current.roamingSettings;
    var version = Windows.ApplicationModel.Package.current.id.version;
    var versionString = version.major + '.' + version.minor + '.' + version.build + '.' + version.revision;

    var _L = function (string) {
        return WinJS.Resources.getString(string).value;
    };

    var app = window.app = {
        launchState: {
            domReady: false,
            gotInfo: false,
            applicationReady: false
        },
        status: {
            initialized: false,
            requesting: false,
            error: null,
            clockOffsetTime: 0,
            zoom: 1
        },
        image: {
            id: window.location.search.replace('?', ''),
            pin: null
        },
        data: {
            image: null
        },
        f: {},
        view: {},
        ui: {},
        timer: {}
    };
    app.image.pin = localStorage.getItem(app.image.id);

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

        // create containers
        app.view.imageContainer = flagrate.createElement('div', { 'class': 'image-container' }).insertTo(app.view.body);
        app.view.infoContainer = flagrate.createElement('div', { 'class': 'info-container' }).insertTo(app.view.body);

        // create progress
        app.view.progress = flagrate.createProgress();

        // main
        app.f.main();

        // craete topAppBar
        app.ui.topAppBar = new WinJS.UI.AppBar(
            flagrate.createElement('div', { id: 'top-app-bar' }).insertTo(app.view.body),
            {
                commands: [
                    new WinJS.UI.AppBarCommand(flagrate.createElement('button'), {
                        section: 'selection',
                        icon: 'back',
                        tooltip: _L('back') + ' (Esc)',
                        onclick: app.f.back
                    })
                ],
                sticky: true,
                placement: 'top'
            }
        );

        // create AppBar
        app.view.deleteButton = flagrate.createElement('button');
        app.view.expirationButton = flagrate.createElement('button');
        app.view.infoButton = flagrate.createElement('button');
        app.view.copyUrlButton = flagrate.createElement('button');
        app.view.openInBrowserButton = flagrate.createElement('button');
        app.view.saveButton = flagrate.createElement('button');
        app.view.openWithButton = flagrate.createElement('button');

        app.ui.appBar = new WinJS.UI.AppBar(
            flagrate.createElement('div', { id: 'app-bar' }).insertTo(app.view.body),
            {
                commands: [
                    new WinJS.UI.AppBarCommand(app.view.deleteButton, {
                        section: 'global',
                        icon: 'delete',
                        label: _L('delete'),
                        tooltip: _L('delete') + ' (Delete)',
                        onclick: app.f.confirmDelete
                    }),
                    new WinJS.UI.AppBarCommand(app.view.expirationButton, {
                        section: 'global',
                        icon: 'clock',
                        label: _L('expiration'),
                        tooltip: _L('expiration') + ' (E)',
                        onclick: app.f.expiration
                    }),
                    new WinJS.UI.AppBarCommand(app.view.infoButton, {
                        section: 'global',
                        icon: 'showresults',
                        label: _L('information'),
                        tooltip: _L('information') + ' (I)',
                        onclick: function () { app.view.infoContainer.toggleClassName('visible'); }
                    }),
                    new WinJS.UI.AppBarCommand(app.view.saveButton, {
                        section: 'selection',
                        icon: 'save',
                        label: _L('save'),
                        tooltip: _L('save') + ' (Ctrl+S)',
                        onclick: app.f.save
                    }),
                    new WinJS.UI.AppBarCommand(app.view.openWithButton, {
                        section: 'selection',
                        icon: 'openwith',
                        label: _L('open with'),
                        tooltip: _L('open with'),
                        onclick: app.f.openWith
                    }),
                    new WinJS.UI.AppBarCommand(app.view.copyUrlButton, {
                        section: 'selection',
                        icon: 'link',
                        label: _L('copy url'),
                        tooltip: _L('copy url') + ' (Ctrl+C)',
                        onclick: app.f.copyUrl
                    }),
                    new WinJS.UI.AppBarCommand(app.view.openInBrowserButton, {
                        section: 'selection',
                        icon: 'go',
                        label: _L('open in browser'),
                        tooltip: _L('open in browser') + ' (B)',
                        onclick: app.f.openInBrowser
                    })
                ],
                sticky: true
            }
        );

        // show AppBars
        app.ui.topAppBar.show();
        app.ui.appBar.show();

        // keyboard shortcuts
        window.addEventListener('keydown', app.f.onKeydownHandler, true);

        // main listeners
        window.addEventListener('resize', app.f.setImage);

        // now ready
        document.getElementById('not-ready').removeNode(true);
    };//<--app.f.init()

    app.f.onKeydownHandler = function (e) {

        if (app.status.requesting === true) {
            return;
        }

        var active = document.activeElement && document.activeElement.tagName;

        if (active !== 'BODY' && active !== 'DIV' && active !== 'BUTTON') { return; }
        if (window.getSelection().toString() !== '') { return; }

        var activated = false;

        // BS:8 | ESC:27 | h:72 | ALT + LEFT -> Back
        if (e.keyCode === 8 || e.keyCode === 27 || e.keyCode === 72 | (e.altKey && e.keyCode === 37)) {
            activated = true;
            app.f.back();
        }

        // LEFT:37 -> Prev
        if (e.keyCode === 37) {
            activated = true;
            app.f.prev();
        }

        // RIGHT:39 -> Next
        if (e.keyCode === 39) {
            activated = true;
            app.f.next();
        }

        // DELETE:46 -> Delete
        if (e.keyCode === 46) {
            activated = true;
            app.f.confirmDelete();
        }

        // e:69 -> Expiration
        if (e.keyCode === 69) {
            activated = true;
            app.f.expiration();
        }

        // i:73 -> Toggle Information
        if (e.keyCode === 73) {
            activated = true;
            app.view.infoContainer.toggleClassName('visible');
        }

        // b:66 -> Open In Browser
        if (e.keyCode === 66) {
            activated = true;
            app.f.openInBrowser();
        }

        // CTRL + c:67 -> Copy URL
        if (e.ctrlKey && e.keyCode === 67) {
            activated = true;
            app.f.copyUrl();
        }

        // CTRL + q:81 -> Quit
        if (e.ctrlKey && e.keyCode === 81) {
            activated = true;
            if (app.status.requesting === false) {
                window.close();
            }
        }

        // CTRL + s:83 -> Save
        if (e.ctrlKey && e.keyCode === 83) {
            activated = true;
            app.f.save();
        }

        if (activated === true) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    app.f.main = function () {
        
        if (app.image === null) {
            new Windows.UI.Popups.MessageDialog(
                app.status.error.text + ' (' + app.status.error.code + ')',
                _L('error')
            ).showAsync().then(function () {
                app.f.back();
            });

            return;
        }

        var imageUrl = '';
        if (app.image.size >= 1048576 && /* todo */false) {
            imageUrl = app.f.getApiRoot(true) + 'images/' + app.image.id + '.jpg?v=' + app.image.__v + '&convert=medium';
        } else {
            imageUrl = app.f.getApiRoot(true) + 'images/' + app.image.id + '.' + app.image.extension + '?v=' + app.image.__v;
        }

        if (app.image.type === 'application/pdf') {
            app.f.getPdf(imageUrl);
            flagrate.Element.addClassName(app.view.body, 'pdf');
        } else {
            app.f.getImage(imageUrl);
        }

        app.view.infoContainer.update();

        flagrate.createElement('button', { 'class': 'remove' }).on('click', function () {
            app.view.infoContainer.toggleClassName('visible');
        }).insertTo(app.view.infoContainer);

        app.view.infoForm = flagrate.createForm().insertTo(app.view.infoContainer);

        var size = Math.round(app.image.size / 1024);
        var sizeSuffix = 'KB';
        if (size >= 1024) {
            size = Math.round(size / 1024);
            sizeSuffix = 'MB';
        }

        if (app.image.name) {
            app.view.infoForm.push({
                label: _L('title'),
                text: app.image.name
            });
        }
        app.view.infoForm.push({
            label: _L('created at'),
            text: new Date(app.image.createdAt).toLocaleString()
        });
        app.view.infoForm.push({
            label: _L('expiry date'),
            text: app.image.expiresAt ? new Date(app.image.expiresAt).toLocaleString() : _L('never expires')
        });
        app.view.infoForm.push({
            label: _L('type'),
            text: app.image.type
        });
        app.view.infoForm.push({
            key: 'size',
            label: _L('size'),
            text: size + sizeSuffix
        });
        app.view.infoForm.push({
            label: _L('via'),
            text: app.image.by.app,
            className: 'via'
        });


    };//<--app.f.main()

    app.f.getInfo = function (done) {

        var xhr = new XMLHttpRequest();

        xhr.addEventListener('readystatechange', function () {

            if (xhr.readyState === 2) {
                if (xhr.getResponseHeader('Date')) {
                    app.status.clockOffsetTime = Date.now() - new Date(xhr.getResponseHeader('Date')).getTime();
                }
            }
        });

        xhr.addEventListener('load', function () {

            if (xhr.status >= 400 && xhr.status < 600) {
                if (xhr.getResponseHeader('Content-Type').match(/json/) === null) {
                    done({
                        code: xhr.status,
                        message: xhr.responseText
                    }, null);
                } else {
                    done(JSON.parse(xhr.responseText).error, null);
                }
                return;
            }

            done(null, JSON.parse(xhr.responseText));
        });

        xhr.open('GET', app.f.getApiRoot(true) + 'images/' + app.image.id + '.json');
        xhr.send();
    };//<--app.f.getInfo()

    app.f.updateInfo = function () {

        app.f.getInfo(function (error, info) {

            if (error) {
                app.image = null;
                app.status.error = error;
            } else {
                app.image.expiresAt = void 0;
                flagrate.extendObject(app.image, info);
            }

            app.f.main();
        });
    };//<--app.f.updateInfo()

    app.f.getImage = function (imageUrl) {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', imageUrl);
        xhr.responseType = 'blob';

        app.view.progress.insertTo(app.view.imageContainer);
        app.view.progress.max = app.image.size;
        app.view.progress.setValue(0);
        app.view.progress.style.opacity = '0';
        setTimeout(function () {
            app.view.progress.style.opacity = '1';
        }, 500);

        var requestTime = Date.now();
        xhr.addEventListener('readystatechange', function () {

            if (xhr.readyState === 2) {
                requestTime = Date.now();

                if (xhr.status >= 400 && xhr.status < 600) {
                    new Windows.UI.Popups.MessageDialog(
                        xhr.statusText + ' (' + xhr.status + ')',
                        _L('error')
                    ).showAsync().then(function () {
                        app.f.back();
                    });
                }
            }
        });

        xhr.addEventListener('progress', function (e) {

            app.view.progress.setValue(e.loaded);
        });

        xhr.addEventListener('load', function () {

            app.view.progress.setValue(app.image.size);

            var time = Date.now() - requestTime;
            var mbps = 0;
            if (time > 10) {
                mbps = Math.round((app.image.size * 8) / (time / 1000) / 1024 / 1024 * 10) / 10;
                if (mbps > 2000) {
                    mbps = 0;
                }
            }

            if (app.view.image) {
                app.view.image.remove();
            }

            app.data.image = xhr.response;
            app.view.image = flagrate.createElement('img', {
                'class': 'image hide',
                src: URL.createObjectURL(app.data.image, { oneTimeOnly: true })
            });

            if (app.image.width && app.image.height) {
                app.view.image.style.maxWidth = app.image.width + 'px';
                app.view.image.style.maxHeight = app.image.height + 'px';
            }

            if (mbps) {
                app.view.infoForm.getField('size')._div.getElementsByTagName('p')[0].insertText(' (' + mbps + 'Mbps)');
            } else {
                app.view.infoForm.getField('size')._div.getElementsByTagName('p')[0].insertText(' (' + _L('cached') + ')');
            }

            app.view.image.addEventListener('load', function () {

                setTimeout(function () {
                    app.view.progress.remove();
                }, 100);

                if (!app.image.width || !app.image.height) {
                    app.image.width = app.view.image.getWidth();
                    app.image.height = app.view.image.getHeight();
                }

                app.f.setImage();
                app.view.image.removeClassName('hide');

                app.view.infoForm.splice(-1, 0, {
                    label: _L('dimensions'),
                    text: app.image.width + '×' + app.image.height + 'px'
                });
            });

            app.view.image.insertTo(app.view.imageContainer);
        });

        xhr.send();
    };//<--app.f.getImage()

    app.f.getPdf = function () {
    };//<--app.f.getPdf()

    app.f.setImage = function () {

        if (!app.view.image || app.image.width === 0 || app.image.height === 0) {
            return;
        }

        app.status.imageContainerW = app.view.imageContainer.getWidth();
        app.status.imageContainerH = app.view.imageContainer.getHeight();

        var isLarge = (
            app.status.imageContainerW < app.image.width ||
            app.status.imageContainerH < app.image.height
        );

        if (isLarge) {

        } else {

        }

        if (app.status.imageContainerH < app.view.image.getHeight()) {
            app.view.image.setStyle({
                marginTop: '0px'
            });
        } else {
            app.view.image.setStyle({
                marginTop: (app.status.imageContainerH / 2 - app.view.image.getHeight() / 2) + 'px'
            });
        }
    };//<--app.f.setImage()

    app.f.expiration = function () {

        if (app.view.expirationFlyout) {
            app.view.expirationFlyout.dispose();
            app.view.expirationFlyout.element.removeNode(true);
            app.view.expirationFlyout = null;
            return;
        }

        app.view.expirationFlyout = new WinJS.UI.Flyout(flagrate.createElement().insertTo(app.view.body));
        app.view.expirationFlyout.addEventListener('afterhide', function () {

            app.view.expirationFlyout.dispose();
            app.view.expirationFlyout.element.removeNode(true);
            app.view.expirationFlyout = null;
        });

        var currentDate = new Date(Date.now() + 1000 * 60 * 60 * 24);

        var datePicker = new WinJS.UI.DatePicker(flagrate.createElement().insertTo(app.view.expirationFlyout.element));
        datePicker.minYear = new Date().getFullYear();
        datePicker.maxYear = new Date().getFullYear() + 1;
        datePicker.yearPattern = "{year.full}";
        datePicker.monthPattern = "{month.abbreviated}";
        datePicker.datePattern = "{day.integer(1)}";
        datePicker.current = currentDate;
        datePicker.element.style.marginRight = '20px';

        var timePicker = new WinJS.UI.TimePicker(flagrate.createElement().insertTo(app.view.expirationFlyout.element));
        timePicker.minuteIncrement = 5;
        timePicker.clock = '24HourClock';
        timePicker.current = currentDate;

        var setButton = flagrate.createElement('button').insertText(_L('set')).insertTo(app.view.expirationFlyout.element);
        setButton.addEventListener('click', function () {

            app.f.updateExpire(
                new Date(
                    (datePicker.current.getMonth() + 1) + '/' +
                    datePicker.current.getDate() + '/' +
                    datePicker.current.getFullYear() + ' ' +
                    timePicker.current.getHours() + ':' +
                    timePicker.current.getMinutes()
                )
            );

            app.view.expirationFlyout.hide();
        });

        flagrate.createElement('br').insertTo(app.view.expirationFlyout.element);

        var neverButton = flagrate.createElement('button', {
            'class': 'action red'
        }).insertText(_L('clear the expiration')).insertTo(app.view.expirationFlyout.element);
        neverButton.addEventListener('click', function () {

            app.f.updateExpire(null);

            app.view.expirationFlyout.hide();
        });

        app.view.expirationFlyout.show(app.view.expirationButton);
    };//<--app.f.expiration()

    app.f.updateExpire = function (time) {

        if (app.status.requesting === true) {
            return;
        }
        app.status.requesting = true;

        // create mask
        app.view.mask = flagrate.createElement('div', { 'class': 'mask' }).insertTo(app.view.body);
        flagrate.createElement('progress', { 'class': 'win-ring' }).insertTo(app.view.mask);

        var expiresAt = null;

        if (time !== null) {
            // offset
            if (typeof time === 'number') {
                expiresAt = Date.now() - app.status.clockOffsetTime + time;
            } else if (time instanceof Date === true) {
                expiresAt = time.getTime();
            }
        }

        var xhr = new XMLHttpRequest();
        xhr.addEventListener('load', function () {

            app.status.requesting = false;
            app.view.mask.remove();

            if (xhr.status >= 400 && xhr.status < 600) {
                var errorText = xhr.responseText;
                if (/json/.test(xhr.getResponseHeader('Content-Type')) === true) {
                    errorText = JSON.parse(xhr.responseText).error.text;
                }

                new Windows.UI.Popups.MessageDialog(
                    errorText + ' (' + xhr.status + ')',
                    _L('failed to update')
                ).showAsync();

                return;
            }

            app.f.updateInfo();
        });
        xhr.open('PUT', app.f.getApiRoot() + 'images/' + app.image.id + '.json');
        xhr.send(JSON.stringify({ pin: app.image.pin, expiresAt: expiresAt }));
    };//<--app.f.updateExpire()

    app.f.openInBrowser = function () {

        if (!app.image || !app.image.url) {
            return;
        }

        Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(app.image.url + '#pin=' + app.image.pin));
    };

    app.f.copyUrl = function () {

        if (!app.image || !app.image.url) {
            return;
        }

        var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
        dataPackage.setText(app.image.url);
        Windows.ApplicationModel.DataTransfer.Clipboard.setContent(dataPackage);
    };

    app.f.openWith = function () {

        if (!app.image || !app.image.extension || !app.data.image) {
            return;
        }

        var filename = app.image.id + '.' + app.image.extension;

        var temporaryFolder = Windows.Storage.ApplicationData.current.temporaryFolder;
        temporaryFolder.createFileAsync(filename, Windows.Storage.CreationCollisionOption.replaceExisting)
            .then(function (file) {

                if (!file) {
                    return;
                }

                file.openAsync(Windows.Storage.FileAccessMode.readWrite).then(function (output) {

                    // Get the IInputStream stream from the blob object
                    var input = app.data.image.msDetachStream();

                    // Copy the stream from the blob to the File stream 
                    Windows.Storage.Streams.RandomAccessStream.copyAsync(input, output).then(function () {

                        output.flushAsync().done(function () {

                            input.close();
                            output.close();

                            temporaryFolder.getFileAsync(filename).then(function (file) {

                                var options = new Windows.System.LauncherOptions();
                                options.displayApplicationPicker = true;

                                Windows.System.Launcher.launchFileAsync(file, options);
                            });
                        });
                    });
                });
        });
    };

    app.f.save = function () {

        if (!app.image || !app.image.extension || !app.data.image) {
            return;
        }

        var filename = app.image.name || app.image.id;
        if (/\.[^.]{3,4}$/.test(filename) === true) {
            filename = filename.match(/^(.+)\.[^.]+$/)[1];
        }

        var savePicker = new Windows.Storage.Pickers.FileSavePicker();
        savePicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
        savePicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;
        savePicker.fileTypeChoices.insert(app.image.type, ['.' + app.image.extension]);
        savePicker.suggestedFileName = filename;

        savePicker.pickSaveFileAsync().then(function (file) {

            if (!file) {
                return;
            }

            file.openAsync(Windows.Storage.FileAccessMode.readWrite).then(function (output) {

                // Get the IInputStream stream from the blob object
                var input = app.data.image.msDetachStream();

                // Copy the stream from the blob to the File stream 
                Windows.Storage.Streams.RandomAccessStream.copyAsync(input, output).then(function () {

                    output.flushAsync().done(function () {
                    
                        input.close();
                        output.close();
                    });
                });
            });
        });//<--savePicker.pickSaveFileAsync()
    };//<--app.f.save()

    app.f.confirmDelete = function () {

        if (app.status.requesting === true) {
            return;
        }
        app.status.requesting = true;

        var dialog = new Windows.UI.Popups.MessageDialog(_L('note-delete-image'));

        dialog.commands.append(new Windows.UI.Popups.UICommand(_L('yes, delete'), function () {

            app.status.requesting = false;
            app.f.delete();
        }));
        dialog.commands.append(new Windows.UI.Popups.UICommand(_L('cancel'), function () {
            app.status.requesting = false;
        }));

        dialog.defaultCommandIndex = 0;
        dialog.cancelCommandIndex = 1;

        dialog.showAsync();
    };//<--app.f.confirmDelete()

    app.f.delete = function () {

        app.status.requesting = true;

        // create mask
        app.view.mask = flagrate.createElement('div', { 'class': 'mask' }).insertTo(app.view.body);
        flagrate.createElement('progress', { 'class': 'win-ring' }).insertTo(app.view.mask);

        var xhr = new XMLHttpRequest();
        xhr.addEventListener('load', function () {

            app.status.requesting = false;
            app.view.mask.remove();

            if (xhr.status >= 400 && xhr.status < 600) {
                var errorText = xhr.responseText;
                if (/json/.test(xhr.getResponseHeader('Content-Type')) === true) {
                    errorText = JSON.parse(xhr.responseText).error.text;
                }

                new Windows.UI.Popups.MessageDialog(
                    errorText + ' (' + xhr.status + ')',
                    _L('failed to delete')
                ).showAsync();

                return;
            }

            new Windows.UI.Popups.MessageDialog(_L('deleted successfully')).showAsync().done(function () {
                localStorage.removeItem(app.image.id);
                app.f.back();
            });
        });
        xhr.open('DELETE', app.f.getApiRoot() + 'images/' + app.image.id + '.json');
        xhr.send('pin=' + app.image.pin);
    };//<--app.f.delete()

    app.f.back = function () {

        if (app.status.requesting === true) {
            return;
        }

        if (window.location.hash === '#target') {
            window.close();
        } else if (window.location.hash === '#history') {
            window.history.back();
        } else {
            window.location.href = '/default.html';
        }
    };//<--app.f.back()

    app.f.prev = function () {

        var images = [];
        var i, l, k, v;

        for (i = 0, l = localStorage.length; i < l; i++) {
            k = localStorage.key(i);
            v = localStorage.getItem(k);

            if (/^[0-9a-f]{24}$/.test(k) === false || /^[a-f0-9\-]{36}$/.test(v) === false) {
                continue;
            }

            images.push(k);
        }

        for (i = 0, l = images.length; i < l; i++) {
            if (images[i] === app.image.id) {
                if (images[i + 1]) {
                    window.location.href = '/viewer.html?' + images[i + 1] + '#viewer';
                }
            }
        }
    };//<--app.f.prev()

    app.f.next = function () {

        var images = [];
        var i, l, k, v;

        for (i = 0, l = localStorage.length; i < l; i++) {
            k = localStorage.key(i);
            v = localStorage.getItem(k);

            if (/^[0-9a-f]{24}$/.test(k) === false || /^[a-f0-9\-]{36}$/.test(v) === false) {
                continue;
            }

            images.push(k);
        }

        for (i = 0, l = images.length; i < l; i++) {
            if (images[i] === app.image.id) {
                if (images[i - 1]) {
                    window.location.href = '/viewer.html?' + images[i - 1] + '#viewer';
                }
            }
        }
    };//<--app.f.next()

    app.f.checkLaunchState = function () {

        if (app.launchState.domReady === true && app.launchState.gotInfo === true && app.launchState.applicationReady === true) {
            if (window.flagrate) {
                app.f.init();
            } else {
                clearTimeout(app.timer.checkLaunchState);
                app.timer.checkLaunchState = setTimeout(app.f.checkLaunchState, 50);
            }
        }
    };//<--app.f.checkLaunchState()

    //
    // early process
    //

    app.f.getInfo(function (error, info) {

        if (error) {
            app.image = null;
            app.status.error = error;
        } else {
            var k;
            for (k in info) {
                app.image[k] = info[k];
            }
        }

        app.launchState.gotInfo = true;
        app.f.checkLaunchState();
    });

    //
    // launch
    //

    window.addEventListener('DOMContentLoaded', function () {

        app.launchState.domReady = true;
        app.f.checkLaunchState();
    });

    A.onloaded = function (e) {

        app.launchState.applicationReady = true;
        app.f.checkLaunchState();
    };

    //
    // start
    //

    A.start();

}());
