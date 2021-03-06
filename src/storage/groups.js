/*
 * vim: ts=4:sw=4:expandtab
 */

'use strict';

const helpers = require('../helpers.js');
const protocol = require('./protocol.js');
const user = require('./user.js');


// create a random group id that we haven't seen before.
function generateNewGroupId() {
    var groupId = helpers.getString(libsignal.crypto.getRandomBytes(16));
    return protocol.getGroup(groupId).then(function(group) {
        if (group === undefined) {
            return groupId;
        } else {
            console.warn('group id collision'); // probably a bad sign.
            return generateNewGroupId();
        }
    });
}

module.exports = {
    createNewGroup: function(numbers, groupId) {
        var groupId = groupId;
        return new Promise(function(resolve) {
            if (groupId !== undefined) {
                resolve(protocol.getGroup(groupId).then(function(group) {
                    if (group !== undefined) {
                        throw new Error("Tried to recreate group");
                    }
                }));
            } else {
                resolve(generateNewGroupId().then(function(newGroupId) {
                    groupId = newGroupId;
                }));
            }
        }).then(function() {
            var me = user.getNumber();
            var haveMe = false;
            var finalNumbers = [];
            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in group");
                if (number == me)
                    haveMe = true;
                if (finalNumbers.indexOf(number) < 0)
                    finalNumbers.push(number);
            }

            if (!haveMe)
                finalNumbers.push(me);

            var groupObject = {numbers: finalNumbers, numberRegistrationIds: {}};
            for (var i in finalNumbers)
                groupObject.numberRegistrationIds[finalNumbers[i]] = {};

            return protocol.putGroup(groupId, groupObject).then(function() {
                return {id: groupId, numbers: finalNumbers};
            });
        });
    },

    getNumbers: function(groupId) {
        return protocol.getGroup(groupId).then(function(group) {
            if (group === undefined)
                return undefined;

            return group.numbers;
        });
    },

    removeNumber: function(groupId, number) {
        return protocol.getGroup(groupId).then(function(group) {
            if (group === undefined)
                return undefined;

            var me = user.getNumber();
            if (number == me)
                throw new Error("Cannot remove ourselves from a group, leave the group instead");

            var i = group.numbers.indexOf(number);
            if (i > -1) {
                group.numbers.splice(i, 1);
                delete group.numberRegistrationIds[number];
                return protocol.putGroup(groupId, group).then(function() {
                    return group.numbers;
                });
            }

            return group.numbers;
        });
    },

    addNumbers: function(groupId, numbers) {
        return protocol.getGroup(groupId).then(function(group) {
            if (group === undefined)
                return undefined;

            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in set to add to group");
                if (group.numbers.indexOf(number) < 0) {
                    group.numbers.push(number);
                    group.numberRegistrationIds[number] = {};
                }
            }

            return protocol.putGroup(groupId, group).then(function() {
                return group.numbers;
            });
        });
    },

    deleteGroup: function(groupId) {
        return protocol.removeGroup(groupId);
    },

    getGroup: function(groupId) {
        return protocol.getGroup(groupId).then(function(group) {
            if (group === undefined)
                return undefined;

            return { id: groupId, numbers: group.numbers };
        });
    },

    updateNumbers: function(groupId, numbers) {
        return protocol.getGroup(groupId).then(function(group) {
            if (group === undefined)
                throw new Error("Tried to update numbers for unknown group");

            if (numbers.filter(textsecure.utils.isNumberSane).length < numbers.length)
                throw new Error("Invalid number in new group members");

            if (group.numbers.filter(function(number) { return numbers.indexOf(number) < 0 }).length > 0)
                throw new Error("Attempted to remove numbers from group with an UPDATE");

            var added = numbers.filter(function(number) { return group.numbers.indexOf(number) < 0; });

            return module.exports.addNumbers(groupId, added).then(function(newGroup) {
                if (numbers.filter(function(number) { return newGroup.indexOf(number) < 0; }).length != 0 ||
                    newGroup.filter(function(number) { return numbers.indexOf(number) < 0; }).length != 0) {
                    throw new Error("Error calculating group member difference");
                }

                return added;
            });
        });
    },

    needUpdateByDeviceRegistrationId: function(groupId, number, encodedNumber, registrationId) {
        return protocol.getGroup(groupId).then(function(group) {
            if (group === undefined)
                throw new Error("Unknown group for device registration id");

            if (group.numberRegistrationIds[number] === undefined)
                throw new Error("Unknown number in group for device registration id");

            if (group.numberRegistrationIds[number][encodedNumber] == registrationId)
                return false;

            var needUpdate = group.numberRegistrationIds[number][encodedNumber] !== undefined;
            group.numberRegistrationIds[number][encodedNumber] = registrationId;
            return protocol.putGroup(groupId, group).then(function() {
                return needUpdate;
            });
        });
    },
};
