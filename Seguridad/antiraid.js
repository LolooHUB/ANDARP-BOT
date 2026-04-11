const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'AntiRaidSystem',
    async execute(client) {
        // --- ⚙️ CONFIGURACIÓN ---
        const canalAlertasId = '1492339602420273241';
        const rolStaffPing = '1492340791098740777';
        const rolAutorizadoEveryone = '1476767863636234487';

        // 🛡️ 1. DETECCIÓN DE MENCIONES MASIVAS (@everyone / @here)
        client.on(Events.MessageCreate, async (message) => {
            if (!message.guild || message.author.bot) return;

            const tienePermiso = message.member.roles.cache.has(rolAutorizadoEveryone);
            const mencionesMasivas = message.content.includes('@everyone') || message.content.includes('@here');

            if (mencionesMasivas && !tienePermiso) {
                try {
                    await message.delete();
                    await message.member.ban({ reason: 'Anti-Raid: Mención masiva no autorizada.' });

                    const canalAlertas = message.guild.channels.cache.get(canalAlertasId);
                    if (canalAlertas) {
                        const embed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🚨 BANEO AUTOMÁTICO: Mención Masiva')
                            .setDescription(`El usuario **${message.author.tag}** intentó un ping masivo.`)
                            .addFields(
                                { name: '👤 Usuario', value: `<@${message.author.id}>`, inline: true },
                                { name: '🛡️ Acción', value: 'Baneo Permanente', inline: true }
                            )
                            .setTimestamp();

                        await canalAlertas.send({ content: `⚠️ <@&${rolStaffPing}>`, embeds: [embed] });
                    }
                } catch (err) {
                    console.error('Error en Anti-Everyone:', err);
                }
            }
        });

        // 🛡️ 2. PROTECCIÓN DE WEBHOOKS (Creación y Ejecución)
        client.on(Events.WebhooksUpdate, async (channel) => {
            const fetchedLogs = await channel.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.WebhookCreate,
            });
            const creationLog = fetchedLogs.entries.first();

            if (!creationLog) return;

            const { executor, target } = creationLog;

            // Si el ejecutor no es el bot y no tiene permisos de administrador (o el rol autorizado)
            const member = await channel.guild.members.fetch(executor.id);
            if (!member.roles.cache.has(rolAutorizadoEveryone) && executor.id !== client.user.id) {
                try {
                    // Borrar el Webhook inmediatamente
                    const webhooks = await channel.fetchWebhooks();
                    const webhookToDestroy = webhooks.find(wh => wh.id === target.id);
                    if (webhookToDestroy) await webhookToDestroy.delete('Seguridad: Creación no autorizada');

                    const canalAlertas = channel.guild.channels.cache.get(canalAlertasId);
                    if (canalAlertas) {
                        const embedWh = new EmbedBuilder()
                            .setColor('#ff4500')
                            .setTitle('🛡️ Webhook Bloqueado')
                            .setDescription(`Se intentó crear un webhook en <#${channel.id}>.`)
                            .addFields(
                                { name: '👮 Ejecutor', value: `<@${executor.id}>`, inline: true },
                                { name: '⚡ Estado', value: 'Borrado inmediatamente', inline: true }
                            )
                            .setTimestamp();

                        await canalAlertas.send({ content: `⚠️ <@&${rolStaffPing}> Intento de creación de Webhook.`, embeds: [embedWh] });
                    }
                } catch (err) {
                    console.error('Error en Anti-Webhook:', err);
                }
            }
        });

        // 🛡️ 3. ANTI-CHANNEL RAID (Creación masiva de canales)
        let channelCreations = new Map();
        client.on(Events.ChannelCreate, async (channel) => {
            const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
            const log = auditLogs.entries.first();
            if (!log) return;

            const { executor } = log;
            if (executor.id === client.user.id) return;

            const count = channelCreations.get(executor.id) || 0;
            channelCreations.set(executor.id, count + 1);

            if (count >= 3) { // Si crea 4 canales en 10 segundos
                const member = await channel.guild.members.fetch(executor.id);
                await member.roles.set([]).catch(() => {}); // Quitar todos los roles (quarantena)
                
                const canalAlertas = channel.guild.channels.cache.get(canalAlertasId);
                if (canalAlertas) {
                    await canalAlertas.send(`🚨 **POSIBLE RAID DE CANALES:** <@${executor.id}> ha sido despojado de sus roles por crear canales masivamente. <@&${rolStaffPing}>`);
                }
            }

            setTimeout(() => channelCreations.delete(executor.id), 10000);
        });
    }
};