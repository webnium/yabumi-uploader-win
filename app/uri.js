(function () {

    'use strict';

    WinJS.Application.onactivated = function (e) {

        if (e.detail.kind !== Windows.ApplicationModel.Activation.ActivationKind.protocol) {
            location.href = '/default.html';
        }

        var rawUri = e.detail.uri.rawUri;

        if (rawUri.split('/')[2] === 'viewer' && rawUri.split('/')[3]) {
            setTimeout(function () {
                location.href = '/viewer.html?' + rawUri.split('/')[3] + '#uri';
            }, 0);
        }
    };

    WinJS.Application.start();

}());