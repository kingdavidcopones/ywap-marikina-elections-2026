'use client';

import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {VStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';

export function AccessGate({title = 'Let’s verify your voter record first'}: {title?: string}) {
  return (
    <main className="gate-page">
      <Card maxWidth={440} width="100%" padding={8}>
        <VStack gap={4}>
          <Heading level={1}>{title}</Heading>
          <Text color="secondary" as="p">
            We’ll use your Member ID and last name to confirm that you’re eligible for this election.
          </Text>
          <Button label="Verify my voter record" href="/" variant="primary" />
        </VStack>
      </Card>
    </main>
  );
}
