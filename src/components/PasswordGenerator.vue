<template>
    <form @submit.prevent="$emit('submit', state.password)">
        <TextInput
            ref="input"
            :placeholder="$t('common.password.nineCharacters')"
            :value="state.password"
            class="input"
            obscure
            @input="handleInputPassword"
        />

        <TextInput
            v-model="state.confirmationPassword"
            :placeholder="$t('common.password.confirmPassword')"
            obscure
        />

        <div v-if="state.password.length > 0" class="password-hint-container">
            {{ $t("passwordStrength") }}
            <span
                v-if="state.passwordStrength === 0"
                class="strength very-weak"
            >
                {{ $t("passwordStrength.veryWeak") }}
            </span>
            <span
                v-else-if="state.passwordStrength === 1"
                class="strength weak"
            >
                {{ $t("passwordStrength.weak") }}
            </span>
            <span
                v-else-if="state.passwordStrength === 2"
                class="strength good"
            >
                {{ $t("passwordStrength.good") }}
            </span>
            <span
                v-else-if="state.passwordStrength === 3"
                class="strength strong"
            >
                {{ $t("passwordStrength.strong") }}
            </span>
            <span
                v-else-if="state.passwordStrength === 4"
                class="strength excellent"
            >
                {{ $t("passwordStrength.excellent") }}
            </span>
        </div>

        <div
            v-if="state.password.length > 0 && state.password.length < 9"
            class="password-hint-container"
        >
            {{ $t("common.password.nineCharacters") }}
        </div>

        <div v-if="meritsSuggestions">
            <div
                v-for="(suggestion, index) in state.passwordSuggestion
                    .suggestions"
                :key="index"
                class="password-hint-container"
            >
                {{ suggestion }}
            </div>
        </div>

        <div class="btn-container">
            <Button
                :busy="state.isBusy"
                :disabled="isDisabled"
                :label="$t('common.next')"
                :trailing-icon="mdiArrowRight"
                class="btn"
            />
        </div>
    </form>
</template>

<script lang="ts">
import {
    computed,
    createComponent,
    PropType,
    SetupContext
} from "@vue/composition-api";
import { Component as TextInputComponent } from "../components/TextInput.vue";
import Button from "./Button.vue";
import TextInput from "./TextInput.vue";
import { mdiArrowRight } from "@mdi/js";

// Disallowed words for creating a password
const wordlist: string[] = [
    "hedera",
    "Hedera",
    "hashgraph",
    "hbar",
    "crypto",
    "cryptocoin",
    "wallet",
    "myhbarwallet",
    "myhederawallet",
    "password"
];

export interface State {
    password: string;
    confirmationPassword: string;
    passwordStrength: number;
    passwordSuggestion: string;
}

type ReferenceType = {
    refs: {
        input: TextInputComponent;
    };
};

type Context = SetupContext & ReferenceType;

export default createComponent({
    props: {
        state: (Object as unknown) as PropType<State>
    },
    model: {
        prop: "state",
        event: "change"
    },
    components: {
        Button,
        TextInput
    },
    setup(props: { state: State }, context: SetupContext) {
        const confirmPassword = computed(
            () => props.state.confirmationPassword === props.state.password
        );

        async function handleInputPassword(value: string): Promise<void> {
            const zxcvbn = await import("zxcvbn");

            const passwordMetrics = zxcvbn.default(value, wordlist);

            context.emit("change", {
                ...props.state,
                password: value,
                passwordStrength: passwordMetrics.score,
                passwordSuggestion: passwordMetrics.feedback
            });
        }

        const meritsSuggestions = computed(() => {
            return (
                props.state.password.length >= 9 &&
                props.state.passwordStrength <= 3
            );
        });

        const isDisabled = computed(() => {
            return (
                props.state.password.length < 9 ||
                props.state.passwordStrength < 2 ||
                !confirmPassword.value
            );
        });

        const focusInput = function(): void {
            // In place typecast to intersection type because setup erasure does not
            // match the intersection type (although it should)
            if ((context as Context).refs.input !== undefined) {
                (context as Context).refs.input.focus();
            }
        };

        return {
            mdiArrowRight,
            meritsSuggestions,
            isDisabled,
            handleInputPassword,
            focusInput
        };
    }
});
</script>

<style lang="postcss" scoped>
.input {
    margin-block-end: 20px;
}

.btn-container {
    align-items: center;
    display: flex;
    justify-content: center;
}

.btn {
    margin-block: 40px;
}

.strength {
    font-weight: 600;
    margin-inline-start: 10px;
    text-align: start;
}

.very-weak {
    color: var(--color-washed-black);
}

.weak {
    color: var(--color-coral-red);
}

.good {
    color: var(--color-bubble-bobble-p2);
}

.strong {
    color: var(--color-melbourne-cup);
}

.excellent {
    color: var(--color-melbourne-cup);
}

.password-hint-container {
    color: var(--color-basalt-grey);
    font-family: Montserrat, sans-serif;
    font-size: 14px;
    margin-block-start: 10px;
}
</style>
