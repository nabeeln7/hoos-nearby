const utils = require("../../utils/utils");
const fetch = require("node-fetch");
const url = require('url');

async function retrievePolicy(gatewayIps) {
    const URL = `http://${gatewayIps}:5000/gateway/retrieve-privacy-policy`;
    return await fetch(URL, {
        method: "GET"
    }).then(response => {
        return response.json();
    }).then(policy => {
        return policy;
    }).catch(err => {
        console.error(err);
    });
}

exports.renderPolicySetPage = async function(req, res){
    //receive the Base64 encoded GET params from the nunjucks page
    const encodedGatewayIP = req.query.ip;

    if(encodedGatewayIP) {
        const gatewayIP = utils.decodeFromBase64(encodedGatewayIP);
        const linkGraph = await utils.getLinkGraphData(gatewayIP);
        const linkGraphData = linkGraph["data"]; //{"G1": {"devices": [{"id": "d1",..}, {},..], ..}, "G2": {},...}

        const gateways = Object.keys(linkGraphData); //get the gateway ids => ["G1", "G2",..]
        const allDeviceIds = gateways.flatMap(gateway =>
            linkGraphData[gateway]["devices"].map(deviceData => deviceData["id"])
        ); //[["d1", "d2"], ["d3", ..], ...]
        const allApps = gateways.flatMap(gateway =>
            linkGraphData[gateway]["apps"].map(appData => appData["name"])
        );

        // allDeviceIds still contains duplicate deviceIds, since two gateways can have the same deviceId
        // remove duplicates by creating a set and then converting back to a list
        const deviceList = Array.from(new Set(allDeviceIds));
        deviceList.sort(); // sort to make it better formatted in the UI

        const appList = Array.from(new Set(allApps));
        appList.sort();

        const policy = req.query.policy;
        console.log(policy)
        const data = {
            "policy": policy,
            "gatewayIP": gatewayIP,
            "devices": deviceList,
            "apps": appList,
            "timeUnit": [
                ["Minute", 0, 59],
                ["Hour", 0, 23],
                ["Day of Month", 1, 31],
                ["Month", 1, 12],
                // ["Day of Week", 1, 7]
            ]
        }
        res.render("policy-set-page.nunjucks", data);
    } else {
        res.sendStatus(404);
    }
};

function findIp(appName, gatewayAppMap) {
    for(const ip in gatewayAppMap) {
        for(const appInfo of gatewayAppMap[ip]) {
            if(appInfo.name === appName) {
                return [ip, appInfo["id"]];
            }
        }
    }
    return null;
}

function policyParser(policy, gatewayAppMap) {
    const newPolicy = {
        "sensor-specific": {},
        "app-specific": {},
        "app-sensor": {}
    };

    for(const row of policy) {
        if(row[0].includes("*")) {
            const apps = row[1];
            for(const appName of apps) {
                const appInfo = findIp(appName, gatewayAppMap);
                if(!appInfo) {
                    continue;
                }
                const ip = appInfo[0];
                const appId = appInfo[1];
                if(!newPolicy["app-specific"][ip]) {
                    newPolicy["app-specific"][ip] = {};
                }
                newPolicy["app-specific"][ip][appId] = {
                    "block": row[3] === "Block",
                    "schedule": row[2]
                };
            }
        } else if(row[1].includes("*")) {
            const sensors = row[0];
            for(const sensor of sensors) {
                newPolicy["sensor-specific"][sensor] = {
                    "block": row[3] === "Block",
                    "schedule": row[2]
                };
            }
        } else if(row[0].length && row[1].length) {
            const sensors = row[0];
            const apps = row[1];
            for(const appName of apps) {
                const appInfo = findIp(appName, gatewayAppMap);
                if(!appInfo) {
                    continue;
                }
                const ip = appInfo[0];
                const appId = appInfo[1];
                if(!newPolicy["app-sensor"][ip]) {
                    newPolicy["app-sensor"][ip] = {};
                }
                if(!newPolicy["app-sensor"][ip][appId]) {
                    newPolicy["app-sensor"][ip][appId] = {};
                }
                for(const sensor of sensors) {
                    newPolicy["app-sensor"][ip][appId][sensor] = {
                        "block": row[3] === "Block",
                        "schedule": row[2]
                    };
                }
            }
        }
    }
    return newPolicy;
}

function findGatewayAppMapping(linkGraph) {
    gatewayAppMap = {};
    for(const gatewayId in linkGraph.data) {
        const ip = linkGraph.data[gatewayId].ip;
        const apps = linkGraph.data[gatewayId].apps;
        gatewayAppMap[ip] = apps;
    }
    return gatewayAppMap;
}

function storePolicyFunc() {
    let policy = [];
    function store(req, res, next) {
        if(req.query.ip) {
            req.query.policy = policy;
        } else if(req.body && req.body.policy) {
            policy = JSON.parse(JSON.stringify(req.body.policy));
            for(let i = 0; i < req.body.policy.length; i++) {
                let schedule = req.body.policy[i][2].join(' ');
                schedule += " *";
                req.body.policy[i][2] = schedule;
            }
        }
        next();
    }
    return store;
}

exports.storePolicy = storePolicyFunc;

exports.policyReceiver = async function (req, res) {
    const policy = req.body.policy;
    const gatewayIP = req.body.gatewayIP;
    let linkGraph = await utils.getLinkGraphData(gatewayIP);
    gatewayAppMap = findGatewayAppMapping(linkGraph);

    const newPolicy = policyParser(policy, gatewayAppMap);

    const gatewayIps = [];
    for(const gatewayId in linkGraph.data) {
        gatewayIps.push(linkGraph.data[gatewayId].ip);
    }
    const requests = [];
    for(const ip of gatewayIps) {
        const URL = `http://${ip}:5000/platform/update-privacy-policy`;
        requests.push(fetch(URL, {
            body: JSON.stringify(newPolicy), // must match 'Content-Type' header
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            headers: {
                "content-type": "application/json",
            },
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            referrer: "no-referrer", // *client, no-referrer
        }));
    }
    Promise.all(requests)
        .then(responses => {
            const result = {};
            for(let response of responses) {
                const responseUrl = url.parse(response.url);
                result[responseUrl.hostname] = response.status;
            }
            res.json(result);
        })
        .catch(err => {
            res.json({ error: "something wrong" })
        })
};
