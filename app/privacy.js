(function () {

    'use strict';

    var init = function () {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', app.f.getApiRoot(true) + '../privacy.html');
        xhr.addEventListener('load', function () {

            if (xhr.status === 200) {
                document.getElementById('content').innerHTML = toStaticHTML(xhr.responseText);
            }
        });
        xhr.send();
    };

    WinJS.UI.Pages.define("/privacy.html", {
        ready: function () {

            WinJS.UI.processAll().then(WinJS.Resources.processAll).then(init);
        }
    });

}());
