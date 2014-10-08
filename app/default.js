(function () {

    'use strict';

    var A = WinJS.Application;
    var localSettings = Windows.Storage.ApplicationData.current.localSettings;
    var roamingSettings = Windows.Storage.ApplicationData.current.roamingSettings;

    var _L = window._L = function (string) {
        return WinJS.Resources.getString(string).value;
    };

    var app = window.app = {
        status: {
            loading: false,
            showingSettings: false,
            //gettingImages: [],
            imagesContainerWidth: 600
        },
        images: [],
        history: {},
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
        app.view.imagesContainer = flagrate.Element.extend(document.getElementById('images-container'));

        app.status.imagesContainerWidth = parseInt(window.getComputedStyle(app.view.imagesContainer).width.replace('px', ''), 10);

        // create AppBar
        app.view.appBar = flagrate.createElement('div', { id: 'app-bar', 'class': 'win-ui-dark' }).insertTo(app.view.body);

        app.view.uploadFromCameraButton = flagrate.createElement('button');
        app.view.uploadFromFileButton = flagrate.createElement('button');
        app.view.reloadButton = flagrate.createElement('button');

        app.ui.appBar = new WinJS.UI.AppBar(
            app.view.appBar,
            {
                commands: [
                    new WinJS.UI.AppBarCommand(app.view.uploadFromCameraButton, {
                        section: 'global',
                        icon: 'camera',
                        label: _L('from camera'),
                        tooltip: _L('take a picture') + ' (C)',
                        onclick: function () {
                            window.location.href = '/uploader.html?camera';
                        }
                    }),
                    new WinJS.UI.AppBarCommand(app.view.uploadFromFileButton, {
                        section: 'global',
                        icon: 'add',
                        label: _L('from file'),
                        tooltip: _L('pick a image') + ' (F)',
                        onclick: function () {
                            window.location.href = '/uploader.html?file';
                        }
                    }),
                    new WinJS.UI.AppBarCommand(app.view.reloadButton, {
                        section: 'selection',
                        icon: 'sync',
                        label: _L('reload'),
                        tooltip: _L('reload') + ' (Ctrl+R)',
                        onclick: function () {
                            app.f.main();
                        }
                    }),
                    new WinJS.UI.AppBarCommand(app.view.settingsButton, {
                        section: 'selection',
                        icon: 'settings',
                        label: _L('options'),
                        tooltip: _L('options') + ' (:)',
                        onclick: function () {
                            WinJS.UI.SettingsFlyout.showSettings('optionsSettings', '/options.html');
                        }
                    })
                ],
                sticky: true
            }
        );
        app.ui.appBar.show();

        // keyboard shortcuts
        window.addEventListener('keydown', app.f.onKeydownHandler, true);

        // main
        app.f.main();

        // main listeners
        document.body.addEventListener('scroll', function () {

            clearTimeout(app.timer.scrollToViewImage);
            app.timer.scrollToViewImage = setTimeout(app.f.viewImages, 20);
        });
        window.addEventListener('resize', function () {

            app.status.imagesContainerWidth = parseInt(window.getComputedStyle(app.view.imagesContainer).width.replace('px', ''), 10);
            app.f.viewImages();
        });
    };

    app.f.onKeydownHandler = function (e) {

        if (app.status.showingSettings === true) {
            return;
        }

        var active = document.activeElement && document.activeElement.tagName;

        if (active !== 'BODY' && active !== 'DIV' && active !== 'BUTTON') { return; }
        if (window.getSelection().toString() !== '') { return; }

        var activated = false;

        // c:67 -> Upload from Camera
        if (e.keyCode === 67) {
            activated = true;
            window.location.href = '/uploader.html?camera';
        }

        // f:70 -> Upload from File
        if (e.keyCode === 70) {
            activated = true;
            window.location.href = '/uploader.html?file';
        }

        // ::186 -> Options
        if (e.keyCode === 186) {
            activated = true;
            WinJS.UI.SettingsFlyout.showSettings('optionsSettings', '/options.html');
        }

        // CTRL + q:81 -> Quit
        if (e.ctrlKey && e.keyCode === 81) {
            activated = true;
            window.close();
        }

        // CTRL + r:82 -> Reload
        if (e.ctrlKey && e.keyCode === 82) {
            activated = true;
            window.location.href = '/default.html';
        }

        if (activated === true) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    app.f.main = function () {

        app.status.loading = true;
        app.view.imagesContainer.update();

        app.f.findImages();

        if (roamingSettings.values['config.historyId']) {
            var progress = flagrate.createElement('progress', { 'class': 'win-ring' }).insertTo(app.view.imagesContainer);
            
            var xhr = new XMLHttpRequest();
            xhr.open('GET', app.f.getApiRoot(true) + 'histories/' + roamingSettings.values['config.historyId'] + '.json');
            xhr.addEventListener('load', function () {

                if (xhr.status === 200) {
                    app.history = JSON.parse(xhr.responseText);

                    var i, j, l, m, found, outdated;

                    // mine
                    for (i = 0, l = app.images.length; i < l; i++) {
                        found = false;
                        for (j = 0, m = app.history.images.length; j < m; j++) {
                            if (app.images[i].id === app.history.images[j].id) {
                                found = true;
                                break;
                            }
                        }
                        if (found === false) {
                            outdated = true;

                            app.history.images.push({
                                id: app.images[i].id,
                                pin: app.images[i].pin
                            });
                        }
                    }

                    // theirs
                    for (i = 0, l = app.history.images.length; i < l; i++) {
                        found = false;
                        for (j = 0, m = app.images.length; j < m; j++) {
                            if (app.history.images[i].id === app.images[j].id) {
                                found = true;
                                break;
                            }
                        }
                        if (found === false) {
                            localStorage.setItem(app.history.images[i].id, app.history.images[i].pin);
                        }
                    }

                    app.f.findImages();
                    if (app.images.length !== 0) {
                        app.f.getImages(function () {
                            progress.remove();
                            app.status.loading = false;

                            if (sessionStorage.getItem('default.scrollTop')) {
                                var scrollTop = parseInt(sessionStorage.getItem('default.scrollTop'), 10);
                                app.view.imagesContainer.style.height = (scrollTop + 800) + 'px';
                                document.body.scrollTop = scrollTop;
                                app.f.viewImages();
                                app.view.imagesContainer.style.height = 'auto';
                            } else {
                                app.f.viewImages();
                            }
                        });
                    } else {
                        progress.remove();
                    }

                    if (outdated) {
                        app.f.saveHistory();
                    }
                } else if (xhr.status === 404) {
                    roamingSettings.values['config.historyId'] = null;
                    app.f.getImages(function () {

                        progress.remove();
                        app.status.loading = false;
                        
                        if (sessionStorage.getItem('default.scrollTop')) {
                            var scrollTop = parseInt(sessionStorage.getItem('default.scrollTop'), 10);
                            app.view.imagesContainer.style.height = (scrollTop + 800) + 'px';
                            document.body.scrollTop = scrollTop;
                            app.f.viewImages();
                            app.view.imagesContainer.style.height = 'auto';
                        } else {
                            app.f.viewImages();
                        }
                    });
                }
            });
            xhr.send();
        } else {
            if (app.images.length !== 0) {
                app.f.getImages(function () {

                    app.status.loading = false;
                    
                    if (sessionStorage.getItem('default.scrollTop')) {
                        var scrollTop = parseInt(sessionStorage.getItem('default.scrollTop'), 10);
                        app.view.imagesContainer.style.height = (scrollTop + 800) + 'px';
                        document.body.scrollTop = scrollTop;
                        app.f.viewImages();
                        app.view.imagesContainer.style.height = 'auto';
                    } else {
                        app.f.viewImages();
                    }
                });
            }
        }
    };

    app.f.findImages = function () {

        var images = [];

        var i, j, l, m, k, v, image;

        for (i = 0, l = localStorage.length; i < l; i++) {
            k = localStorage.key(i);
            v = localStorage.getItem(k);

            if (/^[0-9a-f]{24}$/.test(k) === false || /^[a-f0-9\-]{36}$/.test(v) === false) {
                continue;
            }

            images.push({
                id: k,
                pin: v
            });
        }

        for (i = 0, l = images.length; i < l; i++) {
            image = images[i];

            for (j = 0, m = app.images.length; j < m; j++) {
                if (app.images[j].id === image.id) {
                    image = null;
                    break;
                }
            }

            if (image === null) {
                continue;
            }

            app.images.unshift(image);
        }
    };

    app.f.createImageOnClick = function (image) {
        return function (e) {
            window.location.href = '/viewer.html?' + image.id + '#history';
        };
    };

    app.f.getThumbnail = function (image) {

        var url = app.f.getApiRoot(true) + 'images/' + image.id + '.';

        if (image.extension === 'gif' && image.size > 1024 * 1024) {
            url += 'jpg?v=' + image.__v + '&convert=low';
        } else if (image.extension !== 'gif' && (image.width + image.height > 2000 || image.size > 1024 * 400)) {
            url += 'jpg?v=' + image.__v + '&convert=low';
        } else {
            url += image.extension + '?v=' + image.__v;
        }

        var img = flagrate.createElement('img', {
            src: url,
            onload: 'this.className = "visible"'
        }).insertTo(image._div);
    };

    app.f.viewImages = function () {

        if (app.status.loading === true) {
            return;
        }

        var width = app.status.imagesContainerWidth;
        var height = 0;

        var viewScroll = document.body.scrollTop;
        var viewHeight = window.innerHeight;

        var lines = [];
        var line = null;

        app.view.imagesContainer.update();

        var i, l, j, m, image, size, sizeSuffix;

        // clear contents
        i = app.view.imagesContainer.childNodes.length;
        while (i--) {
            flagrate.Element.remove(app.view.imagesContainer.childNodes[i]);
        }

        var targetImages = [];

        for (i = 0, l = app.images.length; i < l; i++) {
            image = app.images[i];

            if (line === null || line.width === width) {
                if (line !== null) {
                    height += line.height + 10;
                }

                line = {
                    _div: flagrate.createElement(),
                    images: [],
                    width: 0,
                    height: 200
                };
                lines.push(line);
                line._div.insertTo(app.view.imagesContainer);
            }

            line.images.push(image);

            if (!image.width) {
                image.width = 210;
            }
            if (!image.height) {
                image.height = 297;
            }

            image._width = Math.round(image.width * 200 / image.height);
            image._height = line.height;

            if (image._width > width * 0.8) {
                image._width = width;
                image._height = Math.round(image.height * width / image.width);
            }

            if (image._div) {
                image._div.setStyle({
                    width: image._width + 'px',
                    height: image._height + 'px'
                }).insertTo(line._div);
            } else {
                image._div = flagrate.createElement().setStyle({
                    width: image._width + 'px',
                    height: image._height + 'px'
                }).insertTo(line._div);

                image._div.on('click', app.f.createImageOnClick(image));

                size = Math.round(image.size / 1024);
                sizeSuffix = 'KB';
                if (size >= 1024) {
                    size = Math.round(size / 1024);
                    sizeSuffix = 'MB';
                }

                image._div.title = (image.name || image.id) + ' (' + image.type + ', ' + size + sizeSuffix + ')';
            }

            // get thumbnail if display range
            if (!image.acquiredThumbnail && (height > viewScroll - 400) && (height < viewScroll + viewHeight)) {
                targetImages.push(image);
            }

            line.width += image._width;
            line.height = image._height;

            if (line.width > (width - ((line.images.length - 1) * 10)) * 0.8) {
                line.height = Math.floor(line.height * (width - ((line.images.length - 1) * 10)) / line.width);
                line.width = 0;

                for (j = 0, m = line.images.length; j < m; j++) {
                    line.images[j]._width = Math.floor(line.images[j]._width * line.height / line.images[j]._height);
                    line.images[j]._height = line.height;

                    if (j === m - 1) {
                        line.images[j]._width = (width - ((line.images.length - 1) * 10)) - line.width;
                        line.width = width;
                    } else {
                        line.width += line.images[j]._width;
                    }

                    line.images[j]._div.style.width = line.images[j]._width + 'px';
                    line.images[j]._div.style.height = line.height + 'px';
                }
            }

            if (height > viewScroll + viewHeight + 1280) {
                break;
            }
        }//<--for app.images

        // update scroll state
        clearTimeout(app.timer.updateScrollTop);
        app.timer.updateScrollTop = setTimeout(function () {

            for (i = 0, l = targetImages.length; i < l; i++) {
                targetImages[i].acquiredThumbnail = true;
                app.f.getThumbnail(targetImages[i]);
            }

            sessionStorage.setItem('default.scrollTop', viewScroll.toString(10));
        }, 250);
    };//<--app.f.viewImages()

    app.f.getImages = function (done) {

        var xhr = new XMLHttpRequest();

        xhr.addEventListener('load', function () {

            if (xhr.status === 200) {
                var images = JSON.parse(xhr.responseText);

                app.images.forEach(function (image) {

                    var i, l, found = false;
                    for (i = 0, l = images.length; i < l; i++) {
                        if (images[i].id === image.id) {
                            found = true;
                            break;
                        }
                    }

                    if (found === false) {
                        localStorage.removeItem(image.id);
                    }
                });//<--app.images.forEach()

                app.images = images;
            } else {
                new Windows.UI.Popups.MessageDialog(
                    xhr.statusText + ' (' + xhr.status + ')',
                    _L('error')
                ).showAsync();
            }

            done();
        });

        var ids = [];

        app.images.forEach(function (image) {
            ids.push(image.id);
        });

        xhr.open('POST', app.f.getApiRoot(true) + 'images.json');
        xhr.send('_method=get&id=' + ids.join('%2B'));
    };

    app.f.saveHistory = function () {

        var xhr = new XMLHttpRequest();
        xhr.open('PUT', app.f.getApiRoot() + 'histories/' + roamingSettings.values['config.historyId'] + '.json');
        xhr.send(JSON.stringify(app.history));
    };

    //
    // launch
    //
    A.onloaded = function (e) {

        app.f.init();

        e.setPromise(
            WinJS.UI.processAll()
            .then(WinJS.Resources.processAll)
            .then(function () {
                document.getElementById('not-ready').removeNode();
            })
        );

        A.onsettings = function (e) {
            e.detail.applicationcommands = {
                'optionsSettings': {
                    title: _L('options'),
                    href: 'options.html'
                },
                'privacySettings': {
                    title: _L('privacy'),
                    href: 'privacy.html'
                }
            };

            WinJS.UI.SettingsFlyout.populateSettings(e);
        }
    };

    //
    // start
    //

    A.start();

}());
