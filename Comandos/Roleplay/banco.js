const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');

module.exports = {
    // 1️⃣ PARTE PÚBLICA: SLASH COMMAND PARA CIUDADANOS
    data: new SlashCommandBuilder()
        .setName('banco')
        .setDescription('🏦 Consulta tu saldo y estado de cuenta bancario.'),

    async execute(interaction) {
        try {
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ content: "❌ No tienes una cuenta activa. Tramita tu DNI primero.", ephemeral: true });
            }

            const data = doc.data();
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'CAIXABANK - SERVICIOS AL CLIENTE', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
                .setTitle(`Hola, ${data.nombre}`)
                .setColor(0x00A1DE)
                .addFields(
                    { name: '💰 Saldo Disponible', value: `**${data.banco.toLocaleString('es-ES')}€**`, inline: true },
                    { name: '💳 Cuenta', value: `ES${data.numero_dni}99`, inline: true }
                )
                .setFooter({ text: 'Banc de Catalunya' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: false });

        } catch (error) {
            return interaction.reply({ content: "❌ Error al conectar con el banco.", ephemeral: true });
        }
    },

    // 2️⃣ PARTE PRIVADA: COMANDO ! PARA STAFF (Se llama desde el index.js)
    async handleAdminGive(message) {
        const ROLES_ADMIN = [
            '1476769136209301534', 
            '1476769557539721307', 
            '1476769611675336744'
        ];

        const tienePermiso = message.member.roles.cache.some(role => ROLES_ADMIN.includes(role.id));
        if (!tienePermiso) return; // Ni siquiera responde si no es admin

        const args = message.content.split(' ');
        const targetUser = message.mentions.users.first();
        const cantidad = parseInt(args[2]);

        if (!targetUser || isNaN(cantidad)) return;

        try {
            const userRef = db.collection('usuarios_rp').doc(targetUser.id);
            const doc = await userRef.get();

            if (!doc.exists) return message.reply({ content: "❌ El usuario no tiene DNI.", ephemeral: true }); // Nota: message.reply no es ephemeral de por sí, pero el comando es 'secreto'

            const data = doc.data();
            const nuevoSaldo = (data.banco || 0) + cantidad;

            await userRef.update({ banco: nuevoSaldo });

            // Borramos el comando del staff para que no quede rastro en el chat
            if (message.deletable) await message.delete().catch(() => {});

            // Confirmación que solo ve el staff (si el bot tiene permiso de borrar, el rastro desaparece)
            const msgConfirm = await message.channel.send(`✅ Dinero otorgado a **${data.nombre}**. Nuevo saldo: **${nuevoSaldo.toLocaleString()}€**.`);
            
            // Borramos la confirmación a los 5 segundos para que el canal quede limpio
            setTimeout(() => msgConfirm.delete().catch(() => {}), 5000);

            try {
                await targetUser.send(`🏦 **Ministerio de Hacienda:** Se han ingresado **${cantidad.toLocaleString()}€** en tu cuenta.`);
            } catch (e) {}

        } catch (error) {
            console.error(error);
        }
    }
};