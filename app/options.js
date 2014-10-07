(function () {

    'use strict';

    var localSettings = Windows.Storage.ApplicationData.current.localSettings;
    var roamingSettings = Windows.Storage.ApplicationData.current.roamingSettings;

    var _app = {};

    var init = function () {

        var container = flagrate.Element.extend(document.getElementById('content'));
        container.update();

        //
        // upload
        //

        var uploadSection = flagrate.createElement('div', { 'class': 'win-settings-section' }).insertTo(container);
        flagrate.createElement('h3').insertText(_L('upload')).insertTo(uploadSection);

        var copyURLToClipboardToggleSwitch = new WinJS.UI.ToggleSwitch(flagrate.createElement().insertTo(uploadSection), {
            title: _L('copy url to clipboard'),
            checked: !!roamingSettings.values['config.copyURLToClipboard']
        });
        copyURLToClipboardToggleSwitch.addEventListener('change', function () {

            if (copyURLToClipboardToggleSwitch.checked === true) {
                roamingSettings.values['config.copyURLToClipboard'] = true;
            } else {
                roamingSettings.values['config.copyURLToClipboard'] = false;
            }
        });

        var openImageWithSystemBrowserAfterUploadToggleSwitch = new WinJS.UI.ToggleSwitch(flagrate.createElement().insertTo(uploadSection), {
            title: _L('open image with system browser after upload'),
            checked: !!localSettings.values['config.openSystemBrowserAfterUpload']
        });
        openImageWithSystemBrowserAfterUploadToggleSwitch.addEventListener('change', function () {

            if (openImageWithSystemBrowserAfterUploadToggleSwitch.checked === true) {
                localSettings.values['config.openSystemBrowserAfterUpload'] = true;
            } else {
                localSettings.values['config.openSystemBrowserAfterUpload'] = false;
            }
        });

        flagrate.createElement('label').insertText(_L('default expiration')).insertTo(uploadSection);

        var defaultExpiresSelect = flagrate.createElement('select').insertTo(uploadSection);
        defaultExpiresSelect.addEventListener('change', function () {

            roamingSettings.values['config.defaultExpiration'] = defaultExpiresSelect.value;
        });
        flagrate.createElement('option', { value: '0' }).insertText(_L('never expires')).insertTo(defaultExpiresSelect);
        flagrate.createElement('option', { value: '180000' }).insertText('3 ' + _L('minutes')).insertTo(defaultExpiresSelect);
        flagrate.createElement('option', { value: '1800000' }).insertText('30 ' + _L('minutes')).insertTo(defaultExpiresSelect);
        flagrate.createElement('option', { value: '3600000' }).insertText('60 ' + _L('minutes')).insertTo(defaultExpiresSelect);
        flagrate.createElement('option', { value: '86400000' }).insertText('24 ' + _L('hours')).insertTo(defaultExpiresSelect);
        flagrate.createElement('option', { value: '259200000' }).insertText('3 ' + _L('days')).insertTo(defaultExpiresSelect);
        flagrate.createElement('option', { value: '604800000' }).insertText('7 ' + _L('days')).insertTo(defaultExpiresSelect);
        flagrate.createElement('option', { value: '2592000000' }).insertText('30 ' + _L('days')).insertTo(defaultExpiresSelect);

        if (roamingSettings.values['config.defaultExpiration']) {
            defaultExpiresSelect.value = roamingSettings.values['config.defaultExpiration'];
        } else {
            roamingSettings.values['config.defaultExpiration'] = defaultExpiresSelect.value = '86400000';
        }

        //
        // history
        //

        var historySection = flagrate.createElement('div', { 'class': 'win-settings-section' }).insertTo(container);
        flagrate.createElement('h3').insertText(_L('history')).insertTo(historySection);

        var syncToggleSwitch = new WinJS.UI.ToggleSwitch(flagrate.createElement().insertTo(historySection), {
            title: _L('history syncing'),
            checked: !!roamingSettings.values['config.historyId']
        });
        syncToggleSwitch.addEventListener('change', function () {

            if (syncToggleSwitch.checked === true) {
                syncIdFlyout.show(syncToggleSwitch);
            } else {
                unsyncIdFlyout.show(syncToggleSwitch);
            }
        });

        if (roamingSettings.values['config.historyId']) {
            flagrate.createElement('label').insertText(_L('syncing key')).insertTo(historySection);
            flagrate.createElement('input', {
                type: 'text',
                value: roamingSettings.values['config.historyId'],
                disabled: true
            }).insertTo(historySection);
        }

        var unsyncIdFlyout = _app.unsyncIdFlyout = new WinJS.UI.Flyout(flagrate.createElement().insertTo(app.view.body));
        unsyncIdFlyout.addEventListener('aftershow', function () {
            //
        });
        unsyncIdFlyout.addEventListener('afterhide', function () {

            if (roamingSettings.values['config.historyId']) {
                syncToggleSwitch.checked = true;
            }
        });

        flagrate.createElement('h3').insertText(_L('deactive history syncing')).insertTo(unsyncIdFlyout.element);

        flagrate.createElement('br').insertTo(unsyncIdFlyout.element);

        var unsyncButton = flagrate.createElement('button', {
            'class': 'action'
        }).insertText(_L('deactive on this client only')).insertTo(unsyncIdFlyout.element);
        unsyncButton.addEventListener('click', function () {

            roamingSettings.values['config.historyId'] = null;

            unsyncIdFlyout.hide();
            reload();
        });

        var purgeSyncIdButton = flagrate.createElement('button', {
            'class': 'action red'
        }).insertText(_L('purge syncing key')).insertTo(unsyncIdFlyout.element);
        purgeSyncIdButton.addEventListener('click', function () {

            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', app.f.getApiRoot() + 'histories/' + roamingSettings.values['config.historyId'] + '.json');
            xhr.send();

            roamingSettings.values['config.historyId'] = null;

            unsyncIdFlyout.hide();
            reload();
        });

        var syncIdFlyout = _app.syncIdFlyout = new WinJS.UI.Flyout(flagrate.createElement().insertTo(app.view.body));
        syncIdFlyout.addEventListener('aftershow', function () {

            syncIdInput.focus();
        });
        syncIdFlyout.addEventListener('afterhide', function () {

            if (!roamingSettings.values['config.historyId']) {
                syncToggleSwitch.checked = false;
            }
        });

        var checkSyncId = function () {

            saveSyncIdButton.disabled = true;

            if (syncIdInput.value.length === 24 && /^[a-f0-9]+$/.test(syncIdInput.value)) {
                var xhr = new XMLHttpRequest();
                xhr.open('HEAD', app.f.getApiRoot(true) + 'histories/' + syncIdInput.value + '.json');
                xhr.addEventListener('readystatechange', function () {
                    if (xhr.readyState === 2) {
                        if (xhr.status === 200) {
                            saveSyncIdButton.disabled = false;
                        }
                    }
                });
                xhr.send();
            }
        };

        flagrate.createElement('label').insertText(_L('syncing key') + ': ').insertTo(syncIdFlyout.element);
        var syncIdInput = flagrate.createElement('input', {
            type: 'text',
            placeholder: '...',
            maxlength: '24'
        }).insertTo(syncIdFlyout.element);
        syncIdInput.addEventListener('keyup', checkSyncId);
        syncIdInput.addEventListener('pointerup', checkSyncId);

        var generateSyncIdButton = flagrate.createElement('button').insertText(_L('get a new one')).insertTo(syncIdFlyout.element);
        generateSyncIdButton.addEventListener('click', function () {

            // create mask
            var mask = flagrate.createElement('div', { 'class': 'mask' }).insertTo(syncIdFlyout.element);
            flagrate.createElement('progress', { 'class': 'win-ring' }).insertTo(mask);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', app.f.getApiRoot() + 'histories.json');
            xhr.addEventListener('load', function () {

                if (xhr.status === 201) {
                    var history = JSON.parse(xhr.responseText);
                    syncIdInput.value = history.id;
                    saveSyncIdButton.disabled = false;
                    setTimeout(function () {

                        saveSyncIdButton.click();

                        mask.remove();
                    }, 1000);
                } else {
                    var errorText = xhr.status + ' ' + xhr.responseText;
                    if (/json/.test(xhr.getResponseHeader('Content-Type')) === true) {
                        errorText = JSON.parse(xhr.responseText).error.text;
                    }
                    new Windows.UI.Popups.MessageDialog(errorText + ' (' + xhr.status + ')', _L('error')).showAsync();

                    mask.remove();
                }
            });
            xhr.send();
        });

        flagrate.createElement('br').insertTo(syncIdFlyout.element);

        var saveSyncIdButton = flagrate.createElement('button', {
            'class': 'action',
            disabled: true
        }).insertText(_L('save')).insertTo(syncIdFlyout.element);
        saveSyncIdButton.addEventListener('click', function () {

            if (saveSyncIdButton.disabled === true || syncIdInput.value.length !== 24) {
                return;
            }

            roamingSettings.values['config.historyId'] = syncIdInput.value;

            syncIdFlyout.hide();
            reload();
        });

        //
        // advanced
        //

        var advancedSection = flagrate.createElement('div', { 'class': 'win-settings-section' }).insertTo(container);
        flagrate.createElement('h3').insertText(_L('advanced')).insertTo(advancedSection);
        flagrate.createElement('p').insertText(_L('note-api-root')).insertTo(advancedSection);

        flagrate.createElement('label').insertText('API Root').insertTo(advancedSection);
        flagrate.createElement('small').insertText(_L('note-api-root-https')).insertTo(advancedSection);

        flagrate.createElement('input', {
            type: 'text',
            placeholder: 'yabumi.cc/api/',
            value: roamingSettings.values['config.apiRoot']
        }).on('change', function (e) {

            e.target.value = e.target.value.trim();

            if (/^https?:\/\//.test(e.target.value)) {
                e.target.value = e.target.value.replace(/^https?:\/\//, '');
            }

            if (e.target.value !== '' && /\/$/.test(e.target.value) === false) {
                e.target.value = e.target.value + '/';
            }

            if (e.target.value) {
                roamingSettings.values['config.apiRoot'] = e.target.value;
            } else {
                roamingSettings.values['config.apiRoot'] = null;
            }
        }).insertTo(advancedSection);
    };//<--init()

    var reload = function () {

        if (_app.syncIdFlyout) {
            _app.syncIdFlyout.dispose();
            _app.syncIdFlyout.element.removeNode(true);
        }

        if (_app.unsyncIdFlyout) {
            _app.unsyncIdFlyout.dispose();
            _app.unsyncIdFlyout.element.removeNode(true);
        }

        init();
    };//<--reload()

    WinJS.UI.Pages.define("/options.html", {
        ready: function () {

            app.status.showingSettings = true;

            WinJS.UI.processAll().then(WinJS.Resources.processAll).then(init).then(function () {
                document.getElementById('optionsSettings').winControl.addEventListener('afterhide', function () {

                    if (_app.syncIdFlyout) {
                        _app.syncIdFlyout.dispose();
                        _app.syncIdFlyout.element.removeNode(true);
                    }

                    if (_app.unsyncIdFlyout) {
                        _app.unsyncIdFlyout.dispose();
                        _app.unsyncIdFlyout.element.removeNode(true);
                    }

                    app.status.showingSettings = false;
                });
            });
        }
    });

}());
