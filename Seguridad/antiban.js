const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');

// Mapa para rastrear acciones (Ban, Kick, Warn)
const staffActions = new Map();

module.exports = {
    name: 'StaffSecurityMonitor',
    async execute(client) {
        const canalSecurityId = '1492339602420273241';
        const fundacionRoleId = '1476768951034970253';
        const rolCuarentenaId = '1492342183813189783';

        // Función para procesar la alerta
        const triggerProtocolo = async (guild, executorId, razon) => {
            const member = await guild.members.fetch(executorId).catch(() => null);
            if (!member || member.roles.cache.has(fundacionRoleId)) return;

            // 1. Quitar todos los roles y dar Cuarentena
            await member.roles.set([rolCuarentenaId]).catch(e => console.log("Error al poner en cuarentena"));

            // 2. Avisar al canal de seguridad
            const canalSecurity = guild.channels.cache.get(canalSecurityId);
            if (canalSecurity) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚨 PROTOCOLO DE CUARENTENA ACTIVADO')
                    .setDescription(`El Staff <@${executorId}> ha sido bloqueado por actividad excesiva en poco tiempo.`)
                    .addFields(
                        { name: 'Motivo', value: razon, inline: true },
                        { name: 'Acción tomada', value: 'Roles removidos + Rol Cuarentena', inline: true }
                    )
                    .setTimestamp();

                await canalSecurity.send({ 
                    content: `⚠️ <@&${fundacionRoleId}> **ALERTA DE SEGURIDAD:** Un staff ha sido puesto en cuarentena.`,
                    embeds: [embed] 
                });
            }
        };

        // --- MONITOR DE COMANDOS (Warn / Kick / Ban manuales o slash) ---
        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            const { commandName, user, guild } = interaction;
            const comandosSancion = ['ban', 'kick', 'warn'];

            if (comandosSancion.includes(commandName)) {
                const now = Date.now();
                const data = staffActions.get(user.id) || { count: 0, start: now };

                // Cooldown de 1 minuto (60000 ms)
                if (now - data.start > 60000) {
                    data.count = 1;
                    data.start = now;
                } else {
                    data.count++;
                }

                staffActions.set(user.id, data);

                // Si hace más de 2 acciones en 1 minuto
                if (data.count > 2) {
                    await triggerProtocolo(guild, user.id, `Excedió límite de comandos (/${commandName})`);
                }
            }
        });

        // --- MONITOR DE REGISTRO DE AUDITORÍA (Para bans/kicks manuales de Discord) ---
        client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
            const { action, executorId } = entry;
            
            // Acciones: MemberBanAdd (22), MemberKick (20)
            if (action === AuditLogEvent.MemberBanAdd || action === AuditLogEvent.MemberKick) {
                const now = Date.now();
                const data = staffActions.get(executorId) || { count: 0, start: now };

                if (now - data.start > 60000) {
                    data.count = 1;
                    data.start = now;
                } else {
                    data.count++;
                }

                staffActions.set(executorId, data);

                if (data.count > 2) {
                    await triggerProtocolo(guild, executorId, `Excedió límite de acciones manuales (Audit Log)`);
                }
            }
        });
    }
};