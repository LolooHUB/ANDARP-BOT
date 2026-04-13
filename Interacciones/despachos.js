/**
 * 🏢 SISTEMA DE GESTIÓN DE DESPACHOS v5.2
 * ---------------------------------------------------------
 * Desarrollado para Anda RP - Gestión de accesos temporales
 * Incluye: Persistencia, Sala de Espera y Reintentos de Voz.
 * ---------------------------------------------------------
 */

const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    StringSelectMenuBuilder 
} = require('discord.js');
const ms = require('ms');
const { db } = require('../Comandos/Automatizaciones/firebase');

module.exports = {
    name: 'despacho',
    description: 'Gestiona los roles de despacho con persistencia y sistema de sala de espera.',

    // --- ⚙️ CONFIGURACIÓN DE DESPACHOS ---
    config: {
        '824811313989419018': { // Lolo_
            role: '1490394005094006876', 
            voice: '1491829800451444746', 
            canalTexto: '1490391456123326484', 
            nombre: 'Despacho de Lolo_' 
        },
        '1315779036076707902': { // Francisco Javier
            role: '1490394004569722890', 
            voice: '1491829800451444747',
            canalTexto: '1490391365266313317', 
            nombre: 'Despacho de Francisco Javier' 
        },
        '1324001245735686146': { // Anas
            role: '1490394004569722890', 
            voice: '1491839298356379668', 
            nombre: 'Despacho de Anas' 
        }
    },
    
    salaEsperaId: '1491866105310871797',

    // --- ⌨️ COMANDOS DE PREFIJO ---
    async execute(message, args) {
        const prefix = '!';
        const fullContent = message.content.trim();
        const commandName = fullContent.slice(prefix.length).split(/ +/)[0].toLowerCase();
        const targetMember = message.mentions.members.first();

        const configEjecutor = this.config[message.author.id];
        
        if (!configEjecutor) {
            return message.reply('❌ **Error:** No tienes un despacho asignado en el sistema.');
        }

        if (!targetMember) {
            return message.reply('📖 **Uso Correcto:**\n`!despacho @usuario [tiempo]`\n`!cdespacho @usuario`');
        }

        // Caso: Revocar acceso
        if (commandName === 'cdespacho') {
            console.log(`[LOG] Revocando acceso manual: ${targetMember.user.tag}`);
            await this.finalizarDespacho(message.guild, targetMember.id, configEjecutor.role);
            return message.reply(`✅ Acceso revocado correctamente a **${targetMember.user.username}**.`);
        }

        // Caso: Otorgar acceso
        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h';
            console.log(`[LOG] Otorgando acceso manual: ${targetMember.user.tag} por ${tiempoRaw}`);
            await this.asignarDespacho(message.guild, targetMember, message.author.id, tiempoRaw);
            return message.reply(`✅ Acceso concedido a ${targetMember} por un tiempo de **${tiempoRaw}**.`);
        }
    },

    // --- 🚪 MANEJADOR DE SALA DE ESPERA ---
    async handleWaitingRoom(oldState, newState) {
        if (newState.channelId !== this.salaEsperaId) return;
        
        const member = newState.member;
        if (!member || member.user.bot) return;

        console.log(`[SALA DE ESPERA] Usuario detectado: ${member.user.tag}`);

        const channel = newState.channel;
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🏢 Centro de Visitas - Anda RP')
            .setDescription(`Hola ${member}, has entrado en la sala de espera.\n\n**Selecciona el despacho con el que deseas contactar:**`)
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: 'Sistema de Tráfico de Despachos | 2026' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_despacho_espera')
            .setPlaceholder('🚪 Elige un despacho de la lista...')
            .addOptions(Object.entries(this.config).map(([id, data]) => ({
                label: data.nombre,
                value: id,
                description: `Solicitar acceso al área de ${data.nombre}`,
                emoji: '📂'
            })));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        const msgPregunta = await channel.send({ 
            content: `¡Bienvenido ${member}!`, 
            embeds: [welcomeEmbed], 
            components: [row] 
        }).catch(() => null);

        if (!msgPregunta) return;

        const collector = msgPregunta.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== member.id) {
                return i.reply({ content: '❌ Solo la persona que entró al canal puede usar este menú.', ephemeral: true });
            }

            const eleccionId = i.values[0];
            const dataDespacho = this.config[eleccionId];
            const canalDueño = i.guild.channels.cache.get(dataDespacho.canalTexto);

            if (!canalDueño) {
                return i.reply({ content: `❌ Error: El canal de texto del despacho no está disponible.`, ephemeral: true });
            }

            const rowAcceso = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`apr_desp_${member.id}_${eleccionId}`).setLabel('Permitir Entrada').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`den_desp_${member.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );

            const staffEmbed = new EmbedBuilder()
                .setTitle('🔔 Nueva Solicitud de Entrada')
                .setColor('#e1ff00')
                .setDescription(`El ciudadano ${member} está esperando en la sala.\n\n¿Quieres permitirle el acceso a tu despacho?`)
                .addFields({ name: 'Identificador', value: `\`${member.id}\`` })
                .setTimestamp();

            await canalDueño.send({ 
                content: `<@${eleccionId}>`, 
                embeds: [staffEmbed], 
                components: [rowAcceso] 
            }).catch(() => null);

            await i.update({ 
                content: `⏳ **Solicitud enviada a ${dataDespacho.nombre}.** Por favor, mantente en el canal de voz.`, 
                embeds: [], 
                components: [] 
            });
        });
    },

    // --- 🔘 MANEJADOR DE BOTONES (APROBACIÓN) ---
    async handleButtons(interaction) {
        const [accion, , userId, ownerId] = interaction.customId.split('_');

        if (accion === 'den') {
            console.log(`[DESPACHO] Solicitud denegada para el usuario ${userId}`);
            return interaction.update({ content: '❌ Has denegado el acceso al ciudadano.', embeds: [], components: [] });
        }

        if (accion === 'apr') {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            const dataDespacho = this.config[ownerId];

            if (!member) {
                return interaction.update({ content: '❌ El usuario ya no se encuentra en el servidor.', components: [] });
            }

            // Asignación de permisos
            await this.asignarDespacho(interaction.guild, member, ownerId, '1h');
            
            // Lógica de Movimiento con Reintentos
            if (member.voice.channel) {
                const targetChannel = interaction.guild.channels.cache.get(dataDespacho.voice);
                
                if (targetChannel) {
                    console.log(`[VOZ] Intentando mover a ${member.user.tag} al despacho...`);
                    
                    const moverConReintento = async (reintentos = 2) => {
                        try {
                            await member.voice.setChannel(targetChannel);
                            console.log(`[VOZ] Movimiento exitoso.`);
                            return true;
                        } catch (error) {
                            if (reintentos > 0) {
                                console.log(`[VOZ] Reintentando movimiento en 1.5s... (${reintentos} restantes)`);
                                await new Promise(res => setTimeout(res, 1500));
                                return await moverConReintento(reintentos - 1);
                            }
                            return false;
                        }
                    };

                    const movidoExitosamente = await moverConReintento();

                    if (!movidoExitosamente) {
                        const salaEspera = interaction.guild.channels.cache.get(this.salaEsperaId);
                        if (salaEspera) {
                            await salaEspera.send({ 
                                content: `⚠️ ${member}, no pude moverte automáticamente por permisos de Discord. **Por favor, entra tú mismo al canal: ${targetChannel.name}**.` 
                            }).catch(() => null);
                        }
                        await interaction.channel.send(`⚠️ No se pudo mover a ${member.user.username}. Se le notificó para que entre manualmente.`);
                    }
                }
            }

            await interaction.update({ 
                content: `✅ **Acceso concedido.** El ciudadano ha sido procesado correctamente.`, 
                embeds: [], 
                components: [] 
            });
        }
    },

    // --- 💾 LÓGICA DE ASIGNACIÓN Y BASE DE DATOS ---
    async asignarDespacho(guild, targetMember, ejecutorId, tiempoRaw) {
        const config = this.config[ejecutorId];
        const role = guild.roles.cache.get(config.role);
        const tiempoMs = ms(tiempoRaw);

        if (!tiempoMs || !role) {
            console.error(`[ERROR] Configuración inválida para asignar despacho.`);
            return;
        }

        try {
            await targetMember.roles.add(role);
            
            await db.collection('despachos_activos').doc(targetMember.id).set({
                guildId: guild.id,
                roleId: config.role,
                expiracion: Date.now() + tiempoMs,
                asignadoPor: ejecutorId,
                fechaInicio: new Date().toISOString()
            });

            console.log(`[DB] Guardado: ${targetMember.id} con rol ${config.role}`);

            setTimeout(() => {
                this.finalizarDespacho(guild, targetMember.id, config.role);
            }, tiempoMs);

        } catch (e) { 
            console.error("Error crítico en asignarDespacho:", e); 
        }
    },

    // --- 🧹 LÓGICA DE CIERRE Y LIMPIEZA ---
    async finalizarDespacho(guild, userId, roleId) {
        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            
            if (member) {
                console.log(`[LIMPIEZA] Removiendo acceso a ${member.user.tag}`);
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch(() => null);
                }
                
                // Expulsar de voz si sigue en el despacho para evitar quedarse AFK
                if (member.voice.channel) {
                    await member.voice.setChannel(null).catch(() => null); 
                }
            }
            
            await db.collection('despachos_activos').doc(userId).delete().catch(() => {});
            console.log(`[DB] Documento eliminado para ${userId}`);

        } catch (e) { 
            console.error("Error crítico en finalizarDespacho:", e); 
        }
    }
};