import fs from 'fs/promises';

const config = {
  name: 'mining',
  aliases: ["mn", "mine"],
  description: 'Helps you become a miner',
  usage: '<case>',
  cooldown: 5,
  permissions: [0, 1, 2],
  credits: 'WaifuCat',
  extra: {}
};

const langData = {
  'en_US': {
    'noaccount': '[⚜️] ➜ You do not have an account yet',
    'haveaccount': '[⚜️] ➜ You already have an account',
    'success': '[⚜️] ➜ Success',
    'error': '[⚜️] ➜ Error',
    'shop': '[⚜️]Shop[⚜️]\n[⚜️] ➜ 1 - 1000$\n[⚜️] ➜ 2 - 1500$\n[⚜️] ➜ 3 - 2000$\n[⚜️] ➜ 4 - 2500$\n[⚜️] ➜ 5 - 3000$\n[⚜️] ➜ 6 - 3500$\n[⚜️] ➜ 7 - 4000$\n[⚜️] ➜ 8 - 4500$\n[⚜️] ➜ 9 - 5000$\n[⚜️] ➜ 10 - 5500$',
    'map': '[⚜️]Map[⚜️]\n[⚜️] ➜ 1 - lv2\n[⚜️] ➜ 2 - lv5\n[⚜️] ➜ 3 - lv10\n[⚜️] ➜ 4 - lv15\n[⚜️] ➜ 5 - lv20',
    'menu': '[⚜️]Instruction Menu[⚜️]\n[⚜️] ➜ Use register to create an account\n[⚜️] ➜ Use check to verify information\n[⚜️] ➜ Use upgrade <number> to purchase items\n[⚜️] ➜ Use mine to go mining\n[⚜️] ➜ Use teleport <number> to move to a specified map\n[⚜️] ➜ Use map to view the list of maps\n[⚜️] ➜ Use shop to view the list of items for sale',
    'info': '[⚜️]Player Information[⚜️]\n[⚜️] ➜ Level: {level}\n[⚜️] ➜ Experience: {exp}\n\n[⚜️]Area Information[⚜️]\n{mapInfo}\n\n[⚜️]Equipment Information[⚜️]\n{equipInfo}'
  }
};

let data = {};
let items = {};
let maps = {};
const cooldowns = {};

async function loadData() {
  try {
    const rawData = await fs.readFile('plugins/commands/Game/data.json');
    data = JSON.parse(rawData);

    const rawItemData = await fs.readFile('plugins/commands/Game/item.json');
    items = JSON.parse(rawItemData);

    const rawMapData = await fs.readFile('plugins/commands/Game/map.json');
    maps = JSON.parse(rawMapData);
  } catch (error) {
    console.error(error);
  }
}

(async () => {
  await loadData();
  setInterval(loadData, 1000);
})();

async function onCall({ message, args, getLang }) {
  const targetID = message.senderID;
  const { Users } = global.controllers;

  if (args.length === 0) {
    message.reply(getLang("menu"));
    return;
  } else if (args[0] === 'map') {
    message.reply(getLang("map"));
    return;
  } else if (args[0] === 'shop') { 
    message.reply(getLang("shop"));
    return;
  } else if (args[0] === 'check') {
    const user = data[targetID];

    if (!user) {
      message.reply(getLang("noaccount"));
    } else {
      const equippedItem = items[user.equip];
      const equippedItemInfo = equippedItem
        ? `[⚜️] ➜ Name: ${equippedItem.name}\n[⚜️] ➜ Speed: ${equippedItem.speed}\n[⚜️] ➜ Cooldown: ${equippedItem.countdown}`
        : '[⚜️] ➜ No information available';

      const userMapData = maps[user.map];
      const userMapInfo = userMapData
        ? `[⚜️] ➜ Area: ${userMapData.name}\n[⚜️] ➜ Bonus: x${userMapData.buff}`
        : '[⚜️] ➜ No information available';

      const infoMessage = getLang("info")
        .replace('{level}', user.lv)
        .replace('{exp}', user.exp)
        .replace('{mapInfo}', userMapInfo)
        .replace('{equipInfo}', equippedItemInfo);

      const image = equippedItem.url;
      const imageStream = await global.getStream(image);
      await message.reply({
        body: infoMessage,
        attachment: [imageStream]
      });
    }
  } else if (args[0] === 'register') {
    if (!data[targetID]) {
      data[targetID] = {
        exp: 0,
        lv: 1,
        map: 'map0',
        equip: 'item0'
      };

      try {
        await fs.writeFile('plugins/commands/Game/data.json', JSON.stringify(data, null, 2));
        message.reply(getLang("success"));
      } catch (error) {
        console.error(error);
        message.reply(getLang("error"));
      }
    } else {
      message.reply(getLang("haveaccount"));
    }
  } else if (args[0] === 'mine') {
    const user = data[targetID];
    if (!user) {
        message.reply(getLang("noaccount"));
        return;
    }

    const equippedItem = items[user.equip];
    if (!equippedItem) {
        message.reply("[⚜️] ➜ You don't have any equipment for mining.");
        return;
    }

    const currentTime = Date.now();
    const lastMineTime = cooldowns[targetID] || 0;
    const cooldownDuration = equippedItem.countdown * 1000;

    if (currentTime - lastMineTime < cooldownDuration) {
        const remainingCooldown = Math.ceil((lastMineTime + cooldownDuration - currentTime) / 1000);
        message.reply(`[⚜️] ➜ You need to wait ${remainingCooldown} seconds to continue mining.`);
        return;
    }

    const userMapData = maps[user.map];
    if (!userMapData) {
        message.reply("[⚜️] ➜ No information available about the current area.");
        return;
    }

    const minedAmount = equippedItem.speed;
    const expEarned = minedAmount * userMapData.buff;

    await Users.increaseMoney(targetID, expEarned);

    cooldowns[targetID] = currentTime;
    try {
        user.exp += expEarned;

        while (user.exp >= (user.lv === 1 ? 50 : user.lv * 50)) {
            user.exp -= (user.lv === 1 ? 50 : user.lv * 50);
            user.lv++;
        }

        await fs.writeFile('plugins/commands/Game/data.json', JSON.stringify(data, null, 2));
        message.reply(`[⚜️] ➜ You have mined ${minedAmount} ores. You earned ${expEarned} experience and ${expEarned} $. Your total experience is ${user.exp} and your current level is ${user.lv}.`);
    } catch (error) {
        console.error(error);
        message.reply(getLang("error"));
    }
} else if (args[0] === 'upgrade') {
    const user = data[targetID];
    if (!user) {
        message.reply(getLang("noaccount"));
        return;
    }

    const selectedItem = items[user.equip];
    if (!selectedItem) {
        message.reply("[⚜️] ➜ You don't have any equipment to upgrade.");
        return;
    }

    const upgradeLevel = Number(args[1]);
    const targetItem = items[`item${upgradeLevel}`];

    if (!targetItem) {
        message.reply("[⚜️] ➜ Could not find the item to upgrade.");
        return;
    }

    const upgradeCost = targetItem.price;

    const userMoney = await Users.getMoney(targetID);
    if (userMoney < upgradeCost) {
        message.reply("[⚜️] ➜ You don't have enough money to upgrade the item.");
        return;
    }

    const currentTime = Date.now();
    const lastUpgradeTime = cooldowns[targetID] || 0;
    const upgradeCooldown = 60 * 60 * 1000;

    if (currentTime - lastUpgradeTime < upgradeCooldown) {
        const remainingCooldown = Math.ceil((lastUpgradeTime + upgradeCooldown - currentTime) / 1000);
        message.reply(`[⚜️] ➜ You need to wait ${remainingCooldown} seconds to continue upgrading.`);
        return;
    }

    try {
        await Users.decreaseMoney(targetID, upgradeCost);

        user.equip = `item${upgradeLevel}`;

        await fs.writeFile('plugins/commands/Game/data.json', JSON.stringify(data, null, 2));
        message.reply(`[⚜️] ➜ You purchased ${targetItem.name} for ${upgradeCost} $`);
        cooldowns[targetID] = currentTime;
    } catch (error) {
        console.error(error);
        message.reply(getLang("error"));
    }
} else if (args[0] === 'teleport') {
    const user = data[targetID];
    if (!user) {
        message.reply(getLang("noaccount"));
        return;
    }

    const targetMapLevel = Number(args[1]);
    const userMapData = maps[user.map];

    if (!userMapData) {
        message.reply("[⚜️] ➜ No information available about the current area.");
        return;
    }

    const targetMapData = maps[`map${targetMapLevel}`];

    if (!targetMapData) {
        message.reply("[⚜️] ➜ Could not find information about the map you want to teleport to.");
        return;
    }

    if (user.lv < targetMapData.lv) {
        message.reply("[⚜️] ➜ You don't have the required level to teleport to this map.");
        return;
    }

    user.map = `map${targetMapLevel}`;

    await fs.writeFile('plugins/commands/Game/data.json', JSON.stringify(data, null, 2));
    message.reply(`[⚜️] ➜ You have been teleported to the ${targetMapData.name} map.`);
  }
}

export default {
  config,
  langData,
  onCall
};
