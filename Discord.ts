import DiscordJS, { Client, Message, Channel } from 'discord.js';

type message = string | { files: string[] };

class Discord {

    protected _client: Client;

    get user() {
        return this._client.user;
    }

    public constructor() {
        this._client = new DiscordJS.Client();
    }

    static init() {
        return (new this()).init();
    }

    async init(): Promise<this> {
        return new Promise(resolve => {
            const client = this._client;

            client.on('ready', () => {
                console.log(`Logged in as ${client.user?.tag}`);

                resolve(this);
            });

            client.login(process.env.DISCORD_TOKEN);
        });
    }

    async send(message: message, channelId: string = process.env.DISCORD_DEFAULT_CHANNEL as string) {
        const channel: Channel = await this._client.channels.fetch(channelId);

        await (channel as unknown as { send: (message: message) => Promise<unknown> }).send(message);
    }

    async onMessage(onMessage: (message: Message) => void) {
        this._client.on('message', onMessage);
    }

}

export default Discord;
