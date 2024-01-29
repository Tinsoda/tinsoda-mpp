const Quota = require('./Quota');
const User = require("./User.js");
const Room = require("./Room.js");

//rainbow 
function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}


module.exports = (cl) => {
    rainbowEnabled = false
    function sendAsServer(message) {
        cl.channel.chat({
            participantId:"server",
            user:{
                "color": "#5500ff",
                "name": "server",
                "_id": "server",
            }}, {m:'a', message:message})
    }

    function userset(property, input) {
        cl.user[property] = input;
        let user = new User(cl);
        user.getUserData(true, cl.secret).then((usr) => {
            let dbentry = user.userdb.get(usr.secret);
            if (!dbentry) return;
            dbentry[property] = input;
            user.updatedb();
            cl.server.rooms.forEach((room) => {
                room.updateParticipant(cl.user._id, {
                    [property]: input
                });
            })
        })
    }

    function usersetById(id, property, input) {
        let user = new User(cl);
        for (let [secret, uSr] of user.userdb.entries()) {
            if (uSr._id === id) {
              var utoken = secret;
            }
        }
        user.getUserData(true, utoken).then((usr) => {
            let dbentry = user.userdb.get(utoken);
            if (!dbentry) return;
            dbentry[property] = input;
            user.updatedb();
            cl.server.rooms.forEach((room) => {
                room.updateParticipant(dbentry._id, {
                    [property]: input
                });
            })
        })
    }

    cl.sendArray([{ m: "b" }])
    cl.once("hi", msg => {
        let user = new User(cl);
        user.getUserData(true, msg.secret ? msg.secret : undefined).then((data) => {
            cl.secret = data.secret;
            cl.user = data;
            let msg = {};
            msg.m = "hi";
            msg.motd = cl.server.welcome_motd;
            msg.t = Date.now();
            msg.secret = data.secret;
            delete data.secret;
            msg.u = data;
            msg.v = "Beta";
            cl.sendArray([msg])
        })
    })


    // cl.on("rainbow", msg => {
    //     rainbowEnabled = !rainbowEnabled
    //     console.log(rainbowEnabled)
    // })

    cl.on('admin-userset', msg => {
        if(cl.user.admin !== true) return;
        if(!msg.id) return;
        if(msg.set.name) {
            usersetById(msg.id, "name", msg.set.name)
        }
        if(msg.set.color) {
            usersetById(msg.id, "color", msg.set.color)
        }
    })

    cl.on("room-info", msg => {
        if(cl.user.admin !== true) return;
        cl.channel.sendArray([{
            m:'room-info',
            info:msg.info || ""
        }])
    })

    cl.on("notice", msg => {
        if(cl.user.admin !== true) return;
        cl.channel.Notification(
            "room",
            msg.title || "Notice",
            "",
            msg.text,
            msg.duration || 7000,
            msg.target || "#room",
            msg.class || "",
            msg.id || "notification-"+Math.floor(Math.random() * 999999).toString()
        )
    })

    cl.on("cache-reload", msg => {
        if(cl.user.admin !== true) return;
        cl.channel.sendArray([{
            m:'cache-reload'
        }])
    })

    cl.on("t", msg => {
        if (msg.hasOwnProperty("e") && !isNaN(msg.e))
            cl.sendArray([{
                m: "t",
                t: Date.now(),
                e: msg.e
            }])
    })

    cl.on("ch", msg => {
        if (!msg.hasOwnProperty("set") || !msg.set) msg.set = {};
        if (msg.hasOwnProperty("_id") && typeof msg._id == "string") {
            if (msg._id.length > 512) return;
            if (!cl.staticQuotas.room.attempt()) return;
            cl.setChannel(msg._id, msg.set);
            let param;
            if (cl.channel.isLobby(cl.channel._id)) {
                param = Quota.N_PARAMS_LOBBY;
            } else {
                if (!(cl.user._id == cl.channel.crown.userId)) {
                    param = Quota.N_PARAMS_NORMAL;
                } else {
                    param = Quota.N_PARAMS_RIDICULOUS;
                }
            }
            param.m = "nq";
            cl.sendArray([param])
        }
    })

    cl.on("m", (msg, admin) => {
        // if (!cl.quotas.cursor.attempt() && !admin) return;
        if (!(cl.channel && cl.participantId)) return;
        if (!msg.hasOwnProperty("x")) msg.x = null;
        if (!msg.hasOwnProperty("y")) msg.y = null;
        if (parseInt(msg.x) == NaN) msg.x = null;
        if (parseInt(msg.y) == NaN) msg.y = null;
        cl.channel.emit("m", cl, msg.x, msg.y)
    })

    cl.on("get-crown", msg => {
        if(cl.user.admin !== true) return;
        cl.channel.chown(cl.user.id)
    })

    cl.on("chown", (msg, admin) => {
        if (!cl.quotas.chown.attempt() && !admin) return;
        if (!(cl.channel && cl.participantId)) return;
        //console.log((Date.now() - cl.channel.crown.time))
        //console.log(!(cl.channel.crown.userId != cl.user._id), !((Date.now() - cl.channel.crown.time) > 15000));
        if (!(cl.channel.crown.userId == cl.user._id) && !((Date.now() - cl.channel.crown.time) > 15000)) return;
        if (msg.hasOwnProperty("id")) {
            // console.log(cl.channel.crown)
            if (cl.user._id == cl.channel.crown.userId || cl.channel.crowndropped)
                cl.channel.chown(msg.id);
            if (msg.id == cl.user.id) {
                param = Quota.N_PARAMS_RIDICULOUS;
                param.m = "nq";
                cl.sendArray([param])
            }
        } else {
            if (cl.user._id == cl.channel.crown.userId || cl.channel.crowndropped)
                cl.channel.chown();
            param = Quota.N_PARAMS_NORMAL;
            param.m = "nq";
            cl.sendArray([param])
        }
    })

    cl.on("chset", msg => {
        if (!(cl.channel && cl.participantId)) return;
        if (!(cl.user._id == cl.channel.crown.userId)) return;
        if (!msg.hasOwnProperty("set") || !msg.set) msg.set = cl.channel.verifySet(cl.channel._id, {});
        cl.channel.settings = msg.set;
        cl.channel.updateCh();
    })

    cl.on("a", (msg, admin) => {
        if (!(cl.channel && cl.participantId)) return;
        if (!msg.hasOwnProperty('message')) return;
        if (cl.channel.settings.chat) {
            if (cl.channel.isLobby(cl.channel._id)) {
                if (!cl.quotas.chat.lobby.attempt() && !admin) return;
            } else {
                if (!(cl.user._id == cl.channel.crown.userId)) {
                    if (!cl.quotas.chat.normal.attempt() && !admin) return;
                } else {
                    if (!cl.quotas.chat.insane.attempt() && !admin) return;
                }
            }
            cl.channel.emit('a', cl, msg);
            if (cl.user.admin == true) {
                if (msg.message.startsWith("/color")) {
                    var color = msg.message.split(" ").slice(1).join(" ")
                    userset("color", color)
                }
                if (msg.message.startsWith("/tag")) {
                    var tag = msg.message.split(" ").slice(2).join(" ");
                    var args = msg.message.split(" ");
                    if(args.length > 1) {
                        if(args[1] == "me") {
                            if(isJsonString(tag)) {
                                userset("tag", JSON.parse(tag))
                            } else {
                                userset("tag", tag)
                            }                            
                        } else {
                            var found = false
                            cl.channel.connections.forEach((usr) => {
                                if(usr.user._id == args[1]) found = true
                            })
                            if(found == false) return;
                            if(isJsonString(tag)) {
                                usersetById(args[1], "tag", JSON.parse(tag))
                            } else {
                                usersetById(args[1], "tag", tag)
                            }               
                        }
                    } else {
                        sendAsServer("/tag [me|id] [tag]")
                    }

                }
                if (msg.message.startsWith("/notify")) {
                    var input = msg.message.split(" ").slice(1).join(" ")
                    cl.channel.Notification(
                        "room",
                        "Notice",
                        "",
                        input,
                        7000,
                        "#piano",
                        "",
                        "notification-"+Math.floor(Math.random() * 999999).toString()
                    )
                }
                if (msg.message.startsWith("/js")) {
                    var input = msg.message.split(" ").slice(1).join(" ");
                    if (cl.user.admin == true) {
                      try {
                        sendAsServer("< " + eval(input))
                      } catch(e) {
                        sendAsServer("< " + e)
                      }
                    }
                }
            }

        }
    })

    cl.on('n', msg => {
        if (!(cl.channel && cl.participantId)) return;
        if (!msg.hasOwnProperty('t') || !msg.hasOwnProperty('n')) return;
        if (typeof msg.t != 'number' || typeof msg.n != 'object') return;
        if (cl.channel.settings.crownsolo) {
            if ((cl.channel.crown.userId == cl.user._id) && !cl.channel.crowndropped) {
                cl.channel.playNote(cl, msg);
            }
        } else {
            cl.channel.playNote(cl, msg);
        }
    })

    cl.on('+ls', msg => {
        if (!(cl.channel && cl.participantId)) return;
        cl.server.roomlisteners.set(cl.connectionid, cl);
        let rooms = [];
        for (let room of Array.from(cl.server.rooms.values())) {
            let data = room.fetchData().ch;
            if (room.bans.get(cl.user._id)) {
                data.banned = true;
            }
            if (room.settings.visible) rooms.push(data);
        }
        cl.sendArray([{
            "m": "ls",
            "c": true,
            "u": rooms
        }])
    })

    cl.on('-ls', msg => {
        if (!(cl.channel && cl.participantId)) return;
        cl.server.roomlisteners.delete(cl.connectionid);
    })

    cl.on("userset", msg => {
        if (!(cl.channel && cl.participantId)) return;
        if (!msg.hasOwnProperty("set") || !msg.set) msg.set = {};
        if (msg.set.hasOwnProperty('name') && typeof msg.set.name == "string") {
            if (msg.set.name.length > 40) return;
            // if(!cl.quotas.name.attempt()) return;
            cl.user.name = msg.set.name;
            let user = new User(cl);
            user.getUserData(true, cl.secret).then((usr) => {
                let dbentry = user.userdb.get(usr.secret);
                if (!dbentry) return;
                dbentry.name = msg.set.name;
                user.updatedb();
                cl.server.rooms.forEach((room) => {
                    room.updateParticipant(cl.user._id, {
                        name: msg.set.name
                    });
                })
            })
        }
        if (msg.set.hasOwnProperty('color') && typeof msg.set.color == "string") {
            userset("color", msg.set.color)
        }
        if (msg.set.hasOwnProperty('tag') && typeof msg.set.tag == "string") {
            if(cl.user.admin !== true) return;
            if(isJsonString(msg.set.tag)) {
                userset("tag", JSON.parse(msg.set.tag))
            } else {
                userset("tag", msg.set.tag)
            }
        }
    })

    cl.on('kickban', msg => {
        if (cl.channel.crown == null) return;
        if (!(cl.channel && cl.participantId)) return;
        if (!cl.channel.crown.userId) return;
        if (!(cl.user._id == cl.channel.crown.userId)) return;
        if (msg.hasOwnProperty('_id') && typeof msg._id == "string") {
            if (!cl.quotas.kickban.attempt() && !admin) return;
            let _id = msg._id;
            let ms = msg.ms || 3600000;
            cl.channel.kickban(_id, ms);
        }
    })
    cl.on("bye", msg => {
        cl.destroy();
    })

    cl.on("admin message", msg => {
        if (!(cl.channel && cl.participantId)) return;
        if (!msg.hasOwnProperty('password') || !msg.hasOwnProperty('msg')) return;
        if (typeof msg.msg != 'object') return;
        if (msg.password !== cl.server.adminpass) return;
        cl.ws.emit("message", JSON.stringify([msg.msg]), true);
    })
}
