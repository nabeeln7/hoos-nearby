const request = require('request-promise');
const Keyv = require('keyv');
const Scanner = require('../../../gateway-scanner-lite');

const keyv = new Keyv('mongodb://localhost:27017/gateway_mappings');
// Handle DB connection errors
keyv.on('error', err => console.log('Connection Error', err));

var discovered_gateways = {};

function getMacAddress(ip, all_gateways) {
    for(const entry of Object.entries(all_gateways)) {
        const mac_address = entry[0];
        const ip_address = entry[1];

        if(ip === ip_address) {
            return mac_address;
        }
    }
}

exports.getScanResults = async function(req, res) {
    console.log("scan");

    const scanner = new GatewayScannerLite(10000);

    scanner.on("peripheral-discovered", function (device_name, adv) {
        console.log(`got ${device_name}, ${adv}`);
        discovered_gateways[device_name] = adv;
    });

    scanner.on("scan-complete", handleScanComplete);

    //check if this can be moved outside of getScanResults
    async function handleScanComplete() {

        console.log("discovered gateways =");
        console.log(discovered_gateways);

        //clear storage to remove stale keys
        await keyv.clear();

        //get the link graph from one of the devices. Then create the entire list of devices and display that in a new UI page
        const all_gateways = {};

        //if there is at least one discovered gateway, then take the first ip as sample and then get the entire link graph from that
        var linkGraphUrl = "";
        if(Object.keys(discovered_gateways).length != 0) {
            const sample_ip = Object.entries(discovered_gateways)[0][1];
            //TODO fix
            const linkGraph = await getAppResponse(sample_ip, "linkGraph");
            linkGraphUrl = `http://${sample_ip}:5000/linkGraph`;

            for(const entry of Object.entries(linkGraph["data"])) {
                const mac_address = entry[0];
                const ip_address = entry[1]["ip"];
                all_gateways[mac_address] = ip_address;

                //keep the mac and ip address mappings for future requests
                await keyv.set(mac_address, ip_address);
            }
        }

        /*
        On an OS X machine, you cannot get the MAC address from the advertisement, leaving us to use an id provided
        from noble. So discovered_gateways is a mapping from this noble id to IP address. From the linkgraph API,
        we get the MAC address to IP address mappings. This code puts the actual MAC address of the
        discovered_gateways in a new object.
         */
        var discovered_gateways_fixed = {};
        Object.entries(discovered_gateways).forEach(function(entry) {
            const ip_address = entry[1];
            const mac_address = getMacAddress(ip_address, all_gateways);
            discovered_gateways_fixed[mac_address] = ip_address;
        });

        console.log("all gateways =");
        console.log(all_gateways);

        console.log("discovered_gateways_fixed =");
        console.log(discovered_gateways_fixed);

        const data = {
            "discovered_gateways": discovered_gateways_fixed,
            "all_gateways": all_gateways,
            "linkGraphUrl": linkGraphUrl

        };
        res.render('scanned-devices.nunjucks', data);
        discovered_gateways = {};
    }
};

exports.getGatewayDetails = async function(req, res){
    const macAddress = req.params.mac_address;
    const ipAddress = await keyv.get(macAddress);
    console.log(`from keyv, ipAddress = ${ipAddress}`);

    //TODO fix
    //get the API for the apps of the gateway
    const apps = await getAllApps(ipAddress);

    //get all attached sensors
    const sensors = await getAppResponse(ipAddress, "sensorDiscovery");
    sensors.forEach(sensor => {
        const receiver = sensor["receiver"];
        sensor["receiver"] = receiver.split("-")[0];
    });

    //get all neighbors
    const neighbors = await getAppResponse(ipAddress, "partialLinkGraph");

    const data = {
        "mac_address": macAddress,
        "ip_address": ipAddress,
        "apps": apps,
        "sensors": sensors,
        "neighbors": neighbors
    };

    res.render("gateway-page.nunjucks", data);
};