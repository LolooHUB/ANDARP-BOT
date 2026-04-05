const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'despacho',
    description: 'Asigna un rol de despacho por 1 hora.',
    async execute(message, args) {
        // --- 1. CONFIGURACIÓN DE IDS ---
        const config = {
            '824811313989419018': '1490394005094006876', // Ejecutor A -> Rol A
            '1315779036076707902': '1490394004569722890'  // Ejecutor B -> Rol B
        };

        const ejecutorId = message.author.id;
        const targetMember = message.mentions.members.first();

        // --- 2. VALIDACIONES ---
        // Verificar si el que lo ejecuta tiene permiso
        if (!config[ejecutorId]) {
            return message.reply('❌ No tienes permisos para usar este comando de despacho.');
        }

        // Verificar si mencionó a alguien
        if (!targetMember) {
            return message.reply('⚠️ Debes mencionar a un usuario. Uso: `!despacho @usuario`');
        }

        const roleId = config[ejecutorId];
        const role = message.guild.roles.cache.get(roleId);

        if (!role) {
            return message.reply('❌ Error: No se encontró el rol en el servidor.');
        }

        try {
            // --- 3. ASIGNACIÓN DEL ROL ---
            await targetMember.roles.add(role);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📋 Despacho Asignado')
                .setDescription(`El usuario ${targetMember} ha recibido el rol **${role.name}**.`)
                .addFields(
                    { name: '👤 Autorizado por', value: `<@${ejecutorId}>`, inline: true },
                    { name: '⏳ Duración', value: '1 Hora', inline: true }
                )
                .setFooter({ text: 'El rol se removerá automáticamente.' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

            // --- 4. TEMPORIZADOR (1 HORA = 3600000 ms) ---
            setTimeout(async () => {
                try {
                    // Refrescamos al miembro por si salió y entró del server
                    const memberCheck = await message.guild.members.fetch(targetMember.id).catch(() => null);
                    if (memberCheck && memberCheck.roles.cache.has(roleId)) {
                        await memberCheck.roles.remove(role);
                        console.log(`✅ Rol ${role.name} removido de ${memberCheck.user.tag} tras 1 hora.`);
                    }
                } catch (err) {
                    console.error('❌ Error al quitar el rol de despacho:', err);
                }
            }, 3600000);

        } catch (error) {
            console.error(error);
            message.reply('❌ Hubo un error al intentar asignar el rol.');
        }
    },
};