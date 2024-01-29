"use strict";
import * as http from "http";
import * as https from "https";
import * as assert from "assert";
import * as events from "events";
import * as qs from "querystring";
import * as url from "url";
export default class MatomoTracker extends events.EventEmitter {
    constructor(siteId, trackerUrl, noURLValidation) {
        super();
        events.EventEmitter.call(this);
        assert.ok(siteId && (typeof siteId === "number" || typeof siteId === "string"), "Matomo siteId required.");
        assert.ok(trackerUrl && typeof trackerUrl === "string", "Matomo tracker URL required, e.g. http://example.com/matomo.php");
        if (!noURLValidation) {
            assert.ok(trackerUrl.endsWith("matomo.php") || trackerUrl.endsWith("piwik.php"), 'A tracker URL must end with "matomo.php" or "piwik.php"');
        }
        this.siteId = siteId;
        this.trackerUrl = trackerUrl;
        this.usesHTTPS = trackerUrl.startsWith("https");
    }
    track(options) {
        const hasErrorListeners = this.listeners("error").length;
        if (typeof options === "string") {
            options = {
                url: options,
            };
        }
        if (!options || !options.url) {
            assert.fail("URL to be tracked must be specified.");
            return;
        }
        options.idsite = this.siteId;
        options.rec = 1;
        const requestUrl = this.trackerUrl + "?" + qs.stringify(options);
        const self = this;
        let req;
        if (this.usesHTTPS) {
            req = https.get(requestUrl, handleResponse);
        }
        else {
            req = http.get(requestUrl, handleResponse);
        }
        function handleResponse(res) {
            if (res.statusCode &&
                !/^(20[04]|30[12478])$/.test(res.statusCode.toString())) {
                if (hasErrorListeners) {
                    self.emit("error", res.statusCode);
                }
            }
        }
        req.on("error", (err) => {
            hasErrorListeners && this.emit("error", err.message);
        });
        req.end();
    }
    trackBulk(events, callback) {
        const hasErrorListeners = this.listeners("error").length;
        assert.ok(events && events.length > 0, "Events require at least one.");
        assert.ok(this.siteId !== undefined && this.siteId !== null, "siteId must be specified.");
        const body = JSON.stringify({
            requests: events.map((query) => {
                query.idsite = this.siteId;
                query.rec = 1;
                return "?" + qs.stringify(query);
            }),
        });
        const uri = url.parse(this.trackerUrl);
        const requestOptions = {
            protocol: uri.protocol,
            hostname: uri.hostname,
            port: uri.port,
            path: uri.path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        };
        let req;
        if (this.usesHTTPS) {
            req = https.request(requestOptions, handleResponse);
        }
        else {
            req = http.request(requestOptions, handleResponse);
        }
        const self = this;
        function handleResponse(res) {
            if (res.statusCode &&
                !/^(20[04]|30[12478])$/.test(res.statusCode.toString())) {
                if (hasErrorListeners) {
                    self.emit("error", res.statusCode);
                }
            }
            const data = [];
            res.on("data", (chunk) => {
                data.push(chunk);
            });
            res.on("end", () => {
                const output = Buffer.concat(data).toString();
                typeof callback === "function" && callback(output);
            });
        }
        req.on("error", (err) => {
            hasErrorListeners && this.emit("error", err.message);
        });
        req.write(body);
        req.end();
    }
}
