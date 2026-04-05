const { EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
    name: 'despacho',
    description: 'Gestiona los roles de despacho (asignar, quitar y desconectar voz).',
    async execute(message, args) {
        const prefix = '!';
        const commandName = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

        // --- 1. CONFIGURACIÓN DE IDS ---
        const config = {
            '824811313989419018': '1490394005094006876', // Ejecutor A -> Rol A
            '1315779036076707902': '1490394004569722890'  // Ejecutor B -> Rol B
        };

        const ejecutorId = message.author.id;
        const targetMember = message.mentions.members.first();
        const roleId = config[ejecutorId];

        // --- 2. VALIDACIONES BASE ---
        if (!config[ejecutorId]) {
            return message.reply('❌ No tienes permisos para usar este sistema.');
        }

        if (!targetMember) {
            return message.reply(`⚠️ Uso correcto:\n\`!despacho @usuario [tiempo]\`\n\`!cdespacho @usuario\``);
        }

        const role = message.guild.roles.cache.get(roleId);
        if (!role) {
            return message.reply('❌ Error: No se encontró el rol correspondiente en el servidor.');
        }

        // --- 3. LÓGICA COMANDO: !cdespacho (QUITAR ACCESO + DESCONECTAR) ---
        if (commandName === 'cdespacho') {
            try {
                // Quitar rol
                if (targetMember.roles.cache.has(roleId)) {
                    await targetMember.roles.remove(role);
                }

                // Desconectar de voz si está metido
                if (targetMember.voice.channel) {
                    await targetMember.voice.disconnect('Despacho cancelado manualmente');
                }

                const removeEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔒 Despacho Cancelado')
                    .setDescription(`Se ha retirado el acceso a **${role.name}** y se ha desconectado a ${targetMember} del canal de voz.`)
                    .addFields({ name: '👤 Retirado por', value: `<@${ejecutorId}>`, inline: true })
                    .setTimestamp();

                return await message.channel.send({ embeds: [removeEmbed] });
            } catch (error) {
                console.error(error);
                return message.reply('❌ Hubo un error al intentar quitar el acceso.');
            }
        }

        // --- 4. LÓGICA COMANDO: !despacho (ASIGNAR ACCESO) ---
        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h'; 
            const tiempoMs = ms(tiempoRaw);

            if (!tiempoMs) {
                return message.reply('❌ Formato de tiempo inválido. Usa: `1h`, `30m`, `10s`.');
            }

            try {
                await targetMember.roles.add(role);

                const addEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('📋 Despacho Asignado')
                    .setDescription(`El usuario ${targetMember} ha recibido el rol **${role.name}**.`)
                    .addFields(
                        { name: '👤 Autorizado por', value: `<@${ejecutorId}>`, inline: true },
                        { name: '⏳ Duración', value: `\`${tiempoRaw}\``, inline: true }
                    )
                    .setFooter({ text: 'Se quitará el rol y se desconectará de voz al finalizar.' })
                    .setTimestamp();

                await message.channel.send({ embeds: [addEmbed] });

                // Temporizador de remoción automática + Desconexión
                setTimeout(async () => {
                    try {
                        const memberCheck = await message.guild.members.fetch(targetMember.id).catch(() => null);
                        if (memberCheck) {
                            // Quitar rol si lo tiene
                            if (memberCheck.roles.cache.has(roleId)) {
                                await memberCheck.roles.remove(role);
                            }
                            // Desconectar de voz si sigue ahí
                            if (memberCheck.voice.channel) {
                                await memberCheck.voice.disconnect('Tiempo de despacho finalizado');
                            }
                            console.log(`✅ Acceso finalizado para ${memberCheck.user.tag} tras ${tiempoRaw}.`);
                        }
                    } catch (err) {
                        console.error('❌ Error en remoción automática:', err);
                    }
                }, tiempoMs);

            } catch (error) {
                console.error(error);
                message.reply('❌ Hubo un error al intentar asignar el rol.');
            }
        }
    },
};