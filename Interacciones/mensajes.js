module.exports = {
    async handlePrefixCommands(message) {
        const content = message.content.toLowerCase();

        if (content === '!ayuda') {
            return message.reply("ℹ️ Si necesitas ayuda podes crear un ticket en <#1476763743424610305> o podes ver informacion en <#1476760411310260354>.");
        }

        if (content === '!mod') {
            return message.reply("Un moderador va a responder tu mensaje lo antes posible, por favor se paciente. 🚨"),
            setTimeout(() => {
                message.reply("Esto es puro rol jeje", { ephemeral: true });
            }, 60000);
        }
    }
};