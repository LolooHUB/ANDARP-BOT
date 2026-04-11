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

    async execute(message, args) {
        const prefix = '!';
        const fullContent = message.content.trim();
        const commandName = fullContent.slice(prefix.length).split(/ +/)[0].toLowerCase();
        const targetMember = message.mentions.members.first();

        const configEjecutor = this.config[message.author.id];
        if (!configEjecutor) return message.reply('❌ No estás autorizado.');
        if (!targetMember) return message.reply(`📖 Uso: \`!despacho @user [tiempo]\` o \`!cdespacho @user\``);

        if (commandName === 'cdespacho') {
            await this.finalizarDespacho(message.guild, targetMember.id, configEjecutor.role);
            return message.reply(`✅ Acceso revocado a ${targetMember}.`);
        }

        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h';
            await this.asignarDespacho(message.guild, targetMember, message.author.id, tiempoRaw);
            return message.reply(`✅ Acceso concedido a ${targetMember} por ${tiempoRaw}.`);
        }
    },

    async handleWaitingRoom(oldState, newState) {
        if (newState.channelId !== this.salaEsperaId) return;
        const member = newState.member;
        if (!member || member.user.bot) return;

        const channel = newState.channel;
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🏢 Centro de Visitas - Anda RP')
            .setDescription(`Hola ${member}, selecciona el despacho al que deseas solicitar acceso:`)
            .setFooter({ text: 'Se te moverá automáticamente al ser aceptado.' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_despacho_espera')
            .setPlaceholder('🚪 Elige un despacho...')
            .addOptions(Object.entries(this.config).map(([id, data]) => ({
                label: data.nombre,
                value: id,
                emoji: '📂'
            })));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const msgPregunta = await channel.send({ content: `${member}`, embeds: [welcomeEmbed], components: [row] }).catch(() => null);
        if (!msgPregunta) return;

        const collector = msgPregunta.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== member.id) return i.reply({ content: '❌ No es tu turno.', ephemeral: true });

            const eleccionId = i.values[0];
            const dataDespacho = this.config[eleccionId];
            const canalDueño = i.guild.channels.cache.get(dataDespacho.canalTexto);

            if (!canalDueño) return i.reply({ content: `❌ Error de configuración en el canal de destino.`, ephemeral: true });

            const rowAcceso = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`apr_desp_${member.id}_${eleccionId}`).setLabel('Permitir Entrada').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`den_desp_${member.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
            );

            await canalDueño.send({ 
                content: `<@${eleccionId}>`, 
                embeds: [new EmbedBuilder()
                    .setTitle('🔔 Solicitud de Acceso')
                    .setDescription(`${member} está esperando en la sala.\n\n¿Deseas permitirle la entrada?`)
                    .setColor('#e1ff00')], 
                components: [rowAcceso] 
            }).catch(() => null);

            await i.update({ content: `⏳ Solicitud enviada. Espera en el canal...`, embeds: [], components: [] });
        });
    },

    async handleButtons(interaction) {
        const [accion, , userId, ownerId] = interaction.customId.split('_');
        if (accion === 'den') return interaction.update({ content: '❌ Solicitud denegada.', components: [] });

        if (accion === 'apr') {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            const dataDespacho = this.config[ownerId];

            if (!member) return interaction.update({ content: '❌ El usuario ya no está en el servidor.', components: [] });

            await this.asignarDespacho(interaction.guild, member, ownerId, '1h');
            
            // --- LÓGICA DE MOVIMIENTO CORREGIDA ---
            if (member.voice.channel) {
                const botMember = interaction.guild.members.me;
                const targetChannel = interaction.guild.channels.cache.get(dataDespacho.voice);
                
                // Verificación de permisos y jerarquía
                if (targetChannel && botMember.permissions.has('MoveMembers') && botMember.roles.highest.position > member.roles.highest.position) {
                    await member.voice.setChannel(targetChannel).catch(e => console.error("Error al mover:", e));
                } else {
                    await interaction.channel.send(`⚠️ No tengo permisos suficientes o mi rol es inferior al de ${member.user.username} para moverlo.`);
                }
            }

            await interaction.update({ content: `✅ Acceso concedido a ${member.user.tag}.`, components: [] });
        }
    },

    async asignarDespacho(guild, targetMember, ejecutorId, tiempoRaw) {
        const config = this.config[ejecutorId];
        const role = guild.roles.cache.get(config.role);
        const tiempoMs = ms(tiempoRaw);
        if (!tiempoMs || !role) return;

        try {
            await targetMember.roles.add(role);
            await db.collection('despachos_activos').doc(targetMember.id).set({
                guildId: guild.id,
                roleId: config.role,
                expiracion: Date.now() + tiempoMs,
                asignadoPor: ejecutorId
            });

            setTimeout(() => this.finalizarDespacho(guild, targetMember.id, config.role), tiempoMs);
        } catch (e) { console.error("Error asignando despacho:", e); }
    },

    async finalizarDespacho(guild, userId, roleId) {
        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => null);
                if (member.voice.channel) await member.voice.setChannel(null).catch(() => null); 
            }
            await db.collection('despachos_activos').doc(userId).delete().catch(() => {});
        } catch (e) { console.error("Error finalizando despacho:", e); }
    }
};