(function(exports) {
    "use strict";

    var Window = new Class({
        initialize: function() {
            this.x = 0;
            this.y = 0;
            this.width = 1;
            this.height = 1;
        },
        connect: function(server) {
            this._privateServer = server;
            var connection = this._privateServer.clientConnected(this);
            this._port = connection.clientPort;
            this._port.addEventListener("message", function(messageEvent) {
                this.handleEvent(messageEvent.data);
            }.bind(this));
            this._server = connection.server;
            this._windowId = this._server.createWindow({ x: this.x, y: this.y,
                                                         width: this.width, height: this.height });
            this._server.selectInput({ windowId: this._windowId,
                                       events: ["Expose", "ConfigureNotify"] });
        },
        handleEvent: function(event) {
            switch (event.type) {
            case "ConfigureNotify":
                return this.configureNotify(event);
            case "Expose":
                return this.expose();
            }
        },
        configureNotify: function(event) {
            if (event.x !== undefined)
                this.x = event.x;
            if (event.y !== undefined)
                this.y = event.y;
            if (event.width !== undefined)
                this.width = event.width;
            if (event.height !== undefined)
                this.height = event.height;
        },
        invalidate: function() {
            this._server.invalidateWindow({ windowId: this._windowId });
        },
        expose: function() {
        },
        map: function() {
            this._server.mapWindow({ windowId: this._windowId });
        },
        moveResize: function(x, y, width, height) {
            this._server.configureWindow({ windowId: this._windowId, x: x, y: y, width: width, height: height });
        },
        changeProperty: function(name, value) {
            this._server.changeProperty({ windowId: this._windowId, name: name, value: value });
        },
    });

    var ImageWindow = new Class({
        Extends: Window,
        connect: function(server) {
            this.parent(server);
            this._image = new Image();
            this._image.addEventListener("load", function() {
                this._loaded = true;
                this.moveResize(undefined, undefined, this._image.width, this._image.height);
            }.bind(this));
        },
        _setImage: function(src) {
            this._loaded = false;
            this._image.src = src;
        },
        configureNotify: function(event) {
            this.parent(event);
            this.invalidate();
        },
        expose: function() {
            if (!this._loaded)
                return;

            this._server.drawWithContext(this._windowId, function(ctx) {
                ctx.drawImage(this._image, 0, 0, this.width, this.height);
            }.bind(this));
            var region = new Region();
            region.init_rect(0, 0, this.width, this.height);
            this._server.clearDamage({ windowId: this._windowId,
                                       region: region });
        },
    });

    var BackgroundWindow = new Class({
        Extends: ImageWindow,
        connect: function(server) {
            this.parent(server);
            this._server.changeAttributes({ windowId: this._windowId, overrideRedirect: true });
            this._setImage("demo/data/WoodBackground.jpg");
        },
    });

    var Launcher = new Class({
        Extends: ImageWindow,
        initialize: function(imageSrc, callback) {
            this.parent(imageSrc);
            this._imageSrc = imageSrc;
            this._callback = callback;
        },
        connect: function(server) {
            this.parent(server);
            this._server.changeAttributes({ windowId: this._windowId, overrideRedirect: true, cursor: "pointer" });
            this._server.selectInput({ windowId: this._windowId,
                                       events: ["ButtonPress"] });
            this._setImage(this._imageSrc);
        },
        handleEvent: function(event) {
            switch (event.type) {
            case "ButtonPress":
                return this._callback.call(null);
            default:
                return this.parent(event);
            }
        },
    });

    var FakeTerminalWindow = new Class({
        Extends: Window,
        connect: function(server) {
            this.parent(server);
            this._focused = false;
            this._buffer = "";
            this._server.configureWindow({ windowId: this._windowId,
                                           width: 700, height: 400 });
            this._server.selectInput({ windowId: this._windowId,
                                       events: ["KeyPress"] });
            this._server.changeAttributes({ windowId: this._windowId,
                                            backgroundColor: "#121212" });
        },
        handleEvent: function(event) {
            switch(event.type) {
            case "KeyPress":
                return this._handleKeyPress(event);
            default:
                return this.parent(event);
            }
        },
        expose: function() {
            this._server.drawWithContext(this._windowId, function(ctx) {
                ctx.font = 'bold 10pt "Droid Sans Mono Dotted"';

                var x = 4, y = 16;
                function drawText(text) {
                    var metrics = ctx.measureText(text);
                    ctx.fillText(text, x, y);
                    x += metrics.width;
                }

                ctx.fillStyle = '#8ae234';
                drawText("jstpierre@jstpierre-lappy");

                ctx.fillStyle = '#729fcf';
                drawText(" ~ $ ");

                ctx.fillStyle = '#eeeeec';
                drawText(this._buffer);
            }.bind(this));
            var region = new Region();
            region.init_rect(0, 0, this.width, this.height);
            this._server.clearDamage({ windowId: this._windowId,
                                       region: region });
        },
        _handleKeyPress: function(event) {
            this._buffer += String.fromCharCode(event.charCode);
            this.invalidate();
        },
    });

    var server = new Server(1024, 768);
    document.querySelector(".server").appendChild(server.elem);

    var wm = new WindowManager();
    wm.connect(server);

    var w = new BackgroundWindow();
    w.connect(server);
    w.map();

    var launcher = new Launcher('demo/data/TerminalIcon.png', newWindow);
    launcher.connect(server);
    launcher.moveResize(10, 10, undefined, undefined);
    launcher.map();

    var cascade = 40;
    var windowNumber = 0;

    function newWindow() {
        ++windowNumber;

        var w = new FakeTerminalWindow();
        w.connect(server);
        w.moveResize(windowNumber * cascade, windowNumber * cascade, undefined, undefined);
        w.changeProperty("WM_NAME", "Terminal Window " + windowNumber);
        w.map();
    }

    window.server = server;

})(window);