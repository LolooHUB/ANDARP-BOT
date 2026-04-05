const { EmbedBuilder } = require('discord.js');
const ms = require('ms'); // Importante: npm install ms

module.exports = {
    name: 'despacho',
    description: 'Asigna un rol de despacho por tiempo definido.',
    async execute(message, args) {
        // --- 1. CONFIGURACIÓN DE IDS ---
        const config = {
            '824811313989419018': '1490394005094006876', // Ejecutor A -> Rol A
            '1315779036076707902': '1490394004569722890'  // Ejecutor B -> Rol B
        };

        const ejecutorId = message.author.id;
        const targetMember = message.mentions.members.first();
        
        // --- 2. VALIDACIONES ---
        if (!config[ejecutorId]) {
            return message.reply('❌ No tienes permisos para usar este comando.');
        }

        if (!targetMember) {
            return message.reply('⚠️ Uso: `!despacho @usuario [tiempo]`\nEjemplo: `!despacho @usuario 10m`');
        }

        // --- 3. LÓGICA DE TIEMPO ---
        // Si no hay segundo argumento (args[1]), el tiempo por defecto es 1 hora
        const tiempoRaw = args[1] || '1h'; 
        const tiempoMs = ms(tiempoRaw); // Convierte "1h", "30m", "10s" a milisegundos

        if (!tiempoMs) {
            return message.reply('❌ Formato de tiempo inválido. Usa: `1h`, `30m`, `10s`, etc.');
        }

        const roleId = config[ejecutorId];
        const role = message.guild.roles.cache.get(roleId);

        if (!role) {
            return message.reply('❌ Error: No se encontró el rol en el servidor.');
        }

        try {
            // --- 4. ASIGNACIÓN DEL ROL ---
            await targetMember.roles.add(role);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📋 Despacho Asignado')
                .setDescription(`El usuario ${targetMember} ha recibido el rol **${role.name}**.`)
                .addFields(
                    { name: '👤 Autorizado por', value: `<@${ejecutorId}>`, inline: true },
                    { name: '⏳ Duración', value: `\`${tiempoRaw}\``, inline: true }
                )
                .setFooter({ text: 'El rol se removerá automáticamente.' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

            // --- 5. TEMPORIZADOR DINÁMICO ---
            setTimeout(async () => {
                try {
                    const memberCheck = await message.guild.members.fetch(targetMember.id).catch(() => null);
                    if (memberCheck && memberCheck.roles.cache.has(roleId)) {
                        await memberCheck.roles.remove(role);
                        console.log(`✅ Rol ${role.name} removido de ${memberCheck.user.tag} tras ${tiempoRaw}.`);
                    }
                } catch (err) {
                    console.error('❌ Error al quitar el rol de despacho:', err);
                }
            }, tiempoMs);

        } catch (error) {
            console.error(error);
            message.reply('❌ Hubo un error al intentar asignar el rol.');
        }
    },
};