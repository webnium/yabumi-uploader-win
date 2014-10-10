(function () {

    'use strict';

    var version = Windows.ApplicationModel.Package.current.id.version;
    var versionString = version.major + '.' + version.minor + '.' + version.build + '.' + version.revision;

    var init = function () {

        var container = flagrate.Element.extend(document.getElementById('content'));
        container.update();

        var yabumiSection = flagrate.createElement('div', { 'class': 'win-settings-section' }).insertTo(container);

        flagrate.createElement('h3').insertText('Yabumi Uploader for Windows').insertTo(yabumiSection);
        flagrate.createElement('p').insertText('Version ' + versionString).insertTo(yabumiSection);
        flagrate.createElement('p').insertText('Copyright © 2014 Webnium Inc.').insertTo(yabumiSection);
        flagrate.createElement('p').insertText('Licensed under the MIT License. (except identity assets)').insertTo(yabumiSection);

        var librarySection = flagrate.createElement('div', { 'class': 'win-settings-section' }).insertTo(container);

        flagrate.createElement('h3').insertText('The following sets forth attribution notices for third-party software that may be contained in this application:').insertTo(librarySection);

        flagrate.createElement('br').insertTo(librarySection);

        flagrate.createElement('h3').insertText('Flagrate (included)').insertTo(librarySection);
        flagrate.createElement('p').insertText('Copyright (c) 2013 Webnium and Flagrate Contributors').insertTo(librarySection);
        flagrate.createElement('p').insertText('Licensed under the MIT License.').insertTo(librarySection);

        flagrate.createElement('h3').insertText('PDF.js (included)').insertTo(librarySection);
        flagrate.createElement('p').insertText('Copyright 2012 Mozilla Foundation').insertTo(librarySection);
        flagrate.createElement('p').insertText('Licensed under the Apache License, Version 2.0.').insertTo(librarySection);
    };

    WinJS.UI.Pages.define("/about.html", {
        ready: function () {

            WinJS.UI.processAll().then(WinJS.Resources.processAll).then(init);
        }
    });

}());
