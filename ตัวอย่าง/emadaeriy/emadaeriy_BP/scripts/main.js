import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const SKINS = {
    skin1: { id: "heaver:heaver_emadaeriy_lgfv", name: "เมะดาเรีย", slot: "Legs", icon: "textures/items/heaver_emadaeriy_lgfv_item" },
    skin2: { id: "heaver:heaver_chudemadaeriy_5ln5", name: "ชุดเมะดาเรีย", slot: "Feet", icon: "textures/items/heaver_chudemadaeriy_5ln5_item" }
};
const SELECTOR_ITEM = "heaver:emadaeriy_selector";
const ALLOWED_PLAYERS = ["Iamsayhi1", "Osiki moji"];

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (item?.typeId !== SELECTOR_ITEM) return;
    if (!ALLOWED_PLAYERS.includes(player.name)) {
        player.onScreenDisplay.setActionBar("§c§r§fคุณไม่มีสิทธิ์ใช้งานไอเทมนี้!");
        return;
    }
    system.run(() => openSkinMenu(player));
});

function openSkinMenu(player) {
    const form = new ActionFormData();
    form.title("§d§lเมะดาเรีย");
    form.body("§7เลือกสกินที่ต้องการสวมใส่:");
    form.button("§0§lเมะดาเรีย", SKINS.skin1.icon);
    form.button("§0§lชุดเมะดาเรีย", SKINS.skin2.icon);
    form.button("§c§lถอดสกินทั้งหมด", "textures/ui/cancel");
    form.button("§7§lปิดเมนู", "textures/ui/cancel");
    
    form.show(player).then((res) => {
        if (res.canceled) return;
        switch (res.selection) {
            case 0: toggleSkin(player, SKINS.skin1); break;
            case 1: toggleSkin(player, SKINS.skin2); break;
            case 2: removeAllSkins(player); break;
        }
    });
}

function toggleSkin(player, skin) {
    try {
        const eq = player.getComponent("equippable");
        if (!eq) return;
        const current = eq.getEquipment(skin.slot);
        if (current?.typeId === skin.id) {
            eq.setEquipment(skin.slot, undefined);
            player.onScreenDisplay.setActionBar("§c§l[เมะดาเรีย] §r§fถอด " + skin.name + " §fแล้ว!");
        } else {
            eq.setEquipment(skin.slot, new ItemStack(skin.id, 1));
            player.onScreenDisplay.setActionBar("§a§l[เมะดาเรีย] §r§fสวมใส่ " + skin.name + " §fแล้ว!");
        }
    } catch (e) {}
}

function removeAllSkins(player) {
    try {
        const eq = player.getComponent("equippable");
        if (!eq) return;
        for (const key in SKINS) {
            const current = eq.getEquipment(SKINS[key].slot);
            if (current?.typeId === SKINS[key].id) eq.setEquipment(SKINS[key].slot, undefined);
        }
        player.onScreenDisplay.setActionBar("§c§l[เมะดาเรีย] §r§fถอดสกินทั้งหมดแล้ว!");
    } catch (e) {}
}
// Give selector to allowed players on spawn
world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (!ALLOWED_PLAYERS.includes(player.name)) return;
    
    system.runTimeout(() => {
        try {
            const inventory = player.getComponent("inventory")?.container;
            if (!inventory) return;
            
            // Check if already has selector
            for (let i = 0; i < inventory.size; i++) {
                if (inventory.getItem(i)?.typeId === SELECTOR_ITEM) return;
            }
            
            // Give selector
            inventory.addItem(new ItemStack(SELECTOR_ITEM, 1));
            player.onScreenDisplay.setActionBar("§a§l[เมะดาเรีย] §r§fได้รับ Selector Item แล้ว!");
        } catch (e) {}
    }, 40);
});
// Prevent non-allowed players from wearing skins
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (ALLOWED_PLAYERS.includes(player.name)) continue;
        
        try {
            const eq = player.getComponent("equippable");
            if (!eq) continue;
            
            for (const key in SKINS) {
                const item = eq.getEquipment(SKINS[key].slot);
                if (item?.typeId === SKINS[key].id) {
                    eq.setEquipment(SKINS[key].slot, undefined);
                    player.onScreenDisplay.setActionBar("§c§r§fคุณไม่มีสิทธิ์สวมใส่สกินนี้!");
                }
            }
        } catch (e) {}
    }
}, 20);


console.warn("[เมะดาเรีย] Skin Selector loaded!");
