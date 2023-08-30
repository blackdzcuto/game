import fs from 'fs/promises';

const config = {
  name: 'mining',
  aliases: ["mn", "mine"],
  description: 'Giúp bạn biến thành người thợ mỏ',
  usage: '<case>',
  cooldown: 5,
  permissions: [0, 1, 2],
  credits: 'WaifuCat',
  extra: {}
};

const langData = {
  'vi_VN': {
    'noaccount': '[⚜️] ➜ Bạn chưa có tài khoản',
    'haveaccount': '[⚜️] ➜ Bạn đã có tài khoản',
    'success': '[⚜️] ➜ Thành công',
    'error': '[⚜️] ➜ Lỗi',
    'menu': 'Chưa có',
    'info': '[⚜️]Thông tin người chơi[⚜️]\n[⚜️] ➜ Cấp độ: {level}\n[⚜️] ➜ Kinh nghiệm: {exp}\n\n[⚜️]Thông tin khu vực[⚜️]\n{mapInfo}\n\n[⚜️]Thông tin trang bị[⚜️]\n{equipInfo}'
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
  } else if (args[0] === 'check') {
    const user = data[targetID];

    if (!user) {
      message.reply(getLang("noaccount"));
    } else {
      const equippedItem = items[user.equip];
      const equippedItemInfo = equippedItem
        ? `[⚜️] ➜ Tên: ${equippedItem.name}\n[⚜️] ➜ Tốc độ: ${equippedItem.speed}\n[⚜️] ➜ Thời gian chờ: ${equippedItem.countdown}`
        : '[⚜️] ➜ Không có thông tin';

      const userMapData = maps[user.map];
      const userMapInfo = userMapData
        ? `[⚜️] ➜ Khu vực: ${userMapData.name}\n[⚜️] ➜ Bổ trợ: x${userMapData.buff}`
        : '[⚜️] ➜ Không có thông tin';

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
      message.reply("[⚜️] ➜ Bạn chưa có trang bị để đào.");
      return;
    }

    const currentTime = Date.now();
    const lastMineTime = cooldowns[targetID] || 0;
    const cooldownDuration = equippedItem.countdown * 1000; 

    if (currentTime - lastMineTime < cooldownDuration) {
      const remainingCooldown = Math.ceil((lastMineTime + cooldownDuration - currentTime) / 1000);
      message.reply(`[⚜️] ➜ Bạn cần đợi ${remainingCooldown} giây để tiếp tục đào.`);
      return;
    }

    const userMapData = maps[user.map];
    if (!userMapData) {
      message.reply("[⚜️] ➜ Không có thông tin về khu vực.");
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
      message.reply(`[⚜️] ➜ Bạn đã đào được ${minedAmount} quặng. Bạn nhận được ${expEarned} kinh nghiệm  và ${expEarned} $. Tổng Kinh nghiệm của bạn là ${user.exp} và cấp độ hiện tại là ${user.lv}.`);
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
      message.reply("[⚜️] ➜ Bạn chưa có trang bị để nâng cấp.");
      return;
    }

    const upgradeLevel = Number(args[1]);
    const targetItem = items[`item${upgradeLevel}`]; 

    if (!targetItem) {
      message.reply("[⚜️] ➜ Không tìm thấy vật phẩm để nâng cấp.");
      return;
    }

    const upgradeCost = targetItem.price;

    const userMoney = await Users.getMoney(targetID);
    if (userMoney < upgradeCost) {
      message.reply("[⚜️] ➜ Bạn không có đủ tiền để nâng cấp vật phẩm.");
      return;
    }

    const currentTime = Date.now();
    const lastUpgradeTime = cooldowns[targetID] || 0;
    const upgradeCooldown = 60 * 60 * 1000;

    if (currentTime - lastUpgradeTime < upgradeCooldown) {
      const remainingCooldown = Math.ceil((lastUpgradeTime + upgradeCooldown - currentTime) / 1000);
      message.reply(`[⚜️] ➜ Bạn cần đợi ${remainingCooldown} giây để tiếp tục nâng cấp.`);
      return;
    }

    try {
      await Users.decreaseMoney(targetID, upgradeCost);

      user.equip = `item${upgradeLevel}`;

      await fs.writeFile('plugins/commands/Game/data.json', JSON.stringify(data, null, 2));
      message.reply(`[⚜️] ➜ Bạn đã mua ${targetItem.name} với giá ${upgradeCost} $`);
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
      message.reply("[⚜️] ➜ Không có thông tin về khu vực hiện tại.");
      return;
    }

    const targetMapData = maps[`map${targetMapLevel}`];

    if (!targetMapData) {
      message.reply("[⚜️] ➜ Không tìm thấy thông tin về map bạn muốn dịch chuyển đến.");
      return;
    }

    if (user.lv < targetMapData.lv) {
      message.reply("[⚜️] ➜ Bạn không đủ cấp độ để dịch chuyển đến map này.");
      return;
    }

    user.map = `map${targetMapLevel}`;

    await fs.writeFile('plugins/commands/Game/data.json', JSON.stringify(data, null, 2));
    message.reply(`[⚜️] ➜ Bạn đã được dịch chuyển đến map ${targetMapData.name}.`);
  }
}

export default {
  config,
  langData,
  onCall
};
