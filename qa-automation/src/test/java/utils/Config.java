package utils;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

public class Config {

    private static final Properties properties = new Properties();

    static {

        try (InputStream input =
                     Config.class
                             .getClassLoader()
                             .getResourceAsStream("config.properties")) {

            if (input == null) {
                throw new RuntimeException(
                        "config.properties not found"
                );
            }

            properties.load(input);

        } catch (IOException e) {

            throw new RuntimeException(
                    "Unable to load configuration",
                    e
            );
        }
    }

    public static String get(String key) {

        String systemValue =
                System.getProperty(key);

        if (systemValue != null &&
                !systemValue.isBlank()) {

            return systemValue;
        }

        return properties.getProperty(key);
    }
}