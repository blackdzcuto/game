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
    'noaccount': 'Bạn chưa có tài khoản',
    'haveaccount': 'Bạn đã có tài khoản',
    'success': 'Thành công',
    'error': 'Lỗi', 
    'menu': 'Chưa có',
    'info': 'Thông tin người chơi\nCấp độ: {level}\nKinh nghiệm: {exp}\n\nThông tin khu vực\n{mapInfo}\n\nThông tin trang bị\n{equipInfo}'
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
        ? `Tên: ${equippedItem.name}\nTốc độ: ${equippedItem.speed}\nThời gian chờ: ${equippedItem.countdown}`
        : 'Không có thông tin';

      const userMapData = maps[user.map];
      const userMapInfo = userMapData
        ? `Khu vực: ${userMapData.name}\nBổ trợ: x${userMapData.buff}`
        : 'Không có thông tin';

      const infoMessage = getLang("info")
        .replace('{level}', user.lv)
        .replace('{exp}', user.exp)
        .replace('{mapInfo}', userMapInfo)
        .replace('{equipInfo}', equippedItemInfo);

      message.reply(infoMessage);
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
      message.reply("Bạn chưa có trang bị để đào.");
      return;
    }

    const currentTime = Date.now();
    const lastMineTime = cooldowns[targetID] || 0;
    const cooldownDuration = equippedItem.countdown * 1000; // Convert to milliseconds

    if (currentTime - lastMineTime < cooldownDuration) {
      const remainingCooldown = Math.ceil((lastMineTime + cooldownDuration - currentTime) / 1000);
      message.reply(`Bạn cần đợi ${remainingCooldown} giây để tiếp tục đào.`);
      return;
    }

    const userMapData = maps[user.map];
    if (!userMapData) {
      message.reply("Không có thông tin về khu vực.");
      return;
    }

    // Calculate the mined amount based on the equipped item's speed
    const minedAmount = equippedItem.speed;

    // Calculate experience points based on mined amount and map's buff
    const expEarned = minedAmount * userMapData.buff;

    cooldowns[targetID] = currentTime; // Set cooldown timestamp
    try {
      // Update user's data and save to file
      user.exp += expEarned; // Accumulate exp

      // Automatically convert exp to levels
      while (user.exp >= (user.lv === 1 ? 50 : user.lv * 50)) {
        user.exp -= (user.lv === 1 ? 50 : user.lv * 50);
        user.lv++;
      }

      await fs.writeFile('plugins/commands/Game/data.json', JSON.stringify(data, null, 2));
      message.reply(`Bạn đã đào được ${minedAmount} đơn vị tài nguyên và nhận ${expEarned} exp. Tổng exp của bạn là ${user.exp} và cấp độ là ${user.lv}.`);
    } catch (error) {
      console.error(error);
      message.reply(getLang("error"));
    }
  }
}

export default {
  config,
  langData,
  onCall
};






